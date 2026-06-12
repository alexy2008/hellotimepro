#include "suggestion_service.h"

#include <trantor/utils/Logger.h>

#include <cstdlib>
#include <fstream>
#include <sstream>

#include "api_error.h"
#include "iso_date.h"
#include "mapper.h"
#include "validation.h"

namespace
{
std::string loadTemplate(const AppConfig &config, const std::string &relativePath)
{
    std::ifstream in(config.absRepoRoot() + "/" + relativePath);
    if (!in)
        return "";
    std::ostringstream out;
    out << in.rdbuf();
    return out.str();
}

void replaceAll(std::string &s, const std::string &from, const std::string &to)
{
    if (from.empty())
        return;
    size_t pos = 0;
    while ((pos = s.find(from, pos)) != std::string::npos)
    {
        s.replace(pos, from.size(), to);
        pos += to.size();
    }
}

constexpr const char *kDefaultPromptTemplate =
    "你是中文写作助手。胶囊标题为 {TITLE_OR_EMPTY}（可能为空，为空时请先构思一个 1~18 字中文标题）。"
    "为用户生成一段 260~400 字的时光胶囊正文（content），并给出建议的开启天数（openInDays，1~3650 整数）。"
    "只返回严格 JSON：{\"title\":\"...\",\"content\":\"...\",\"openInDays\":30}。";

// 去除首尾空白（含全角空格之外的常见空白）。
std::string trimWs(const std::string &s)
{
    const auto begin = s.find_first_not_of(" \t\r\n");
    const auto end = s.find_last_not_of(" \t\r\n");
    if (begin == std::string::npos)
        return "";
    return s.substr(begin, end - begin + 1);
}

// 标题清洗用的首尾修饰符号（UTF-8 多字节序列逐个匹配）。
const std::vector<std::string> &decorations()
{
    static const std::vector<std::string> d = {"#", "*", "`", "\"", "'", "　", " ",
                                               "《", "》", "【", "】"};
    return d;
}

bool stripPrefixOnce(std::string &s)
{
    for (const auto &d : decorations())
        if (s.rfind(d, 0) == 0)
        {
            s.erase(0, d.size());
            return true;
        }
    return false;
}

bool stripSuffixOnce(std::string &s)
{
    for (const auto &d : decorations())
        if (s.size() >= d.size() && s.compare(s.size() - d.size(), d.size(), d) == 0)
        {
            s.erase(s.size() - d.size());
            return true;
        }
    return false;
}
}  // namespace

SuggestionService::SuggestionService(const AppConfig &config, std::shared_ptr<LlmClient> llm)
    : config_(config), llm_(std::move(llm)),
      promptTemplate_(loadTemplate(config, "spec/llm/capsule-suggestion.prompt.md"))
{
}

drogon::Task<Json::Value> SuggestionService::suggest(std::optional<std::string> titleOpt)
{
    if (titleOpt && validation::codepointCount(*titleOpt) > 60)
        throw ApiError::validation("标题长度不得超过 60", "title");
    const std::string title = trimWs(titleOpt.value_or(""));
    const bool autoTitle = title.empty();

    std::string generatedBy = "local-template";
    std::optional<std::string> resultTitle;
    std::string content;
    int64_t days = 0;

    try
    {
        const Json::Value node =
            co_await llm_->generateCapsuleSuggestion(buildPrompt(title));
        std::string rawContent =
            node["content"].isString() ? trimWs(node["content"].asString()) : "";
        if (validation::codepointCount(rawContent) > 5000)
            rawContent = mapper::truncateCodepoints(rawContent, 5000);
        if (rawContent.empty())
            throw LlmError("LLM returned empty content");
        int64_t rawDays = 0;
        if (!LlmClient::valueAsInt(node["openInDays"], rawDays))
            throw LlmError("openInDays missing or not a number");
        if (autoTitle)
        {
            const std::string genTitle =
                cleanTitle(node["title"].isString() ? node["title"].asString() : "");
            if (genTitle.empty())
                throw LlmError("LLM returned empty title in auto-title mode");
            resultTitle = genTitle;
        }
        content = rawContent;
        days = std::clamp<int64_t>(rawDays, 1, 3650);
        generatedBy = config_.llm.provider + ":" + config_.llm.model;
    }
    catch (const std::exception &e)
    {
        LOG_WARN << "Capsule suggestion LLM failed; using local fallback: " << e.what();
        const Fallback fb = fallback(autoTitle, title);
        if (autoTitle)
            resultTitle = fb.title;
        content = fb.content;
        days = fb.days;
    }

    const int64_t openAt = iso_date::addSeconds(iso_date::now(), days * 86400);
    Json::Value out(Json::objectValue);
    out["title"] = resultTitle ? Json::Value(*resultTitle) : Json::nullValue;
    out["content"] = content;
    out["openInDays"] = Json::Int64(days);
    out["openAt"] = iso_date::jsonString(openAt);
    out["generatedBy"] = generatedBy;
    out["cached"] = false;
    co_return out;
}

std::string SuggestionService::buildPrompt(const std::string &title) const
{
    std::string prompt = promptTemplate_.empty() ? kDefaultPromptTemplate : promptTemplate_;
    replaceAll(prompt, "{TITLE_OR_EMPTY}", title);
    replaceAll(prompt, "{TITLE}", title);
    return prompt;
}

std::string SuggestionService::cleanTitle(const std::string &raw)
{
    std::string s = trimWs(raw);
    // 换行折叠为空格
    std::string collapsed;
    bool lastWasNewline = false;
    for (char c : s)
    {
        if (c == '\r' || c == '\n')
        {
            if (!lastWasNewline)
                collapsed += ' ';
            lastWasNewline = true;
        }
        else
        {
            collapsed += c;
            lastWasNewline = false;
        }
    }
    s = collapsed;
    while (stripPrefixOnce(s))
    {
    }
    while (stripSuffixOnce(s))
    {
    }
    s = trimWs(s);
    if (validation::codepointCount(s) > 60)
        s = mapper::truncateCodepoints(s, 60);
    return s;
}

SuggestionService::Fallback SuggestionService::fallback(bool autoTitle,
                                                        const std::string &title)
{
    static const std::vector<Fallback> capsules = {
        {"写给一个月后的自己",
         "此刻的我有点想对一个月后的你说说话。不知道那时的天气怎么样，你手边在忙些什么，"
         "有没有把现在挂在心上的那件小事做完。我想记住今天的样子：略显疲惫，却还愿意期待。\n\n"
         "如果这一个月过得顺利，那就好好奖励自己一次；如果有些计划落了空，也别太苛责，"
         "你已经在往前走了。记得多喝水，记得早点睡，记得偶尔抬头看看窗外。我们一个月后见。",
         30},
        {"下个季度想完成的一件事",
         "我想把一件一直拖着的事认真做完，所以把它写进这封信里，让未来的你来检查。"
         "现在的我还在犹豫，担心做不好，担心时间不够；但比起完美，我更怕一直停在原地。\n\n"
         "等你读到这段话时，希望那件事已经有了眉目——哪怕只是迈出了第一步。"
         "无论结果如何，请记得为当初愿意开始的自己鼓一次掌。",
         90},
        {"猜猜下届世界杯冠军是谁",
         "趁着还没揭晓，我想先把心里押注的那支球队写下来，等结果出来再回头验证我的眼光。"
         "此刻的我对足球的热情正浓，会为一个进球大喊，也会为一次失误叹气。\n\n"
         "等这封信开启的时候，冠军应该已经诞生了吧。不管我猜得对不对，"
         "希望那段为热爱呐喊的日子，依然让你觉得值得。",
         365},
        {"明年生日想对自己说的话",
         "又长了一岁的你，过得还好吗？我在今天提前为你写下这封信，想问问你有没有变成"
         "自己喜欢的样子。也许你完成了一些心愿，也许还有遗憾，但这都没关系。\n\n"
         "请记得今天的心情：对未来既忐忑又期待。生日快乐，愿你被爱，也愿你爱人。",
         365},
        {"三年后还在做喜欢的事吗",
         "三年说长不长，说短不短。我把现在最热爱的事写下来，想知道未来的你有没有把它坚持下去。"
         "此刻它带给我很多快乐，也带来一些迷茫。\n\n"
         "如果你还在做它，恭喜你守住了热爱；如果换了方向，也希望那是更适合你的选择。"
         "无论如何，别忘了当初让你眼睛发亮的那个瞬间。",
         1095},
        {"五年后的我在哪座城市",
         "我常常好奇五年后会在哪里醒来：是熟悉的故乡，还是某个还没去过的城市？"
         "此刻的我对未来有许多想象，也有一点不安。\n\n"
         "等你打开这封信，请替现在的我看看窗外——那是我们一起走到的地方。"
         "不管落脚在哪，希望你过得踏实、自在。",
         1825},
        {"十年后还在听同一首歌吗",
         "现在循环播放的那首歌，几乎成了这段日子的背景音。我想把它悄悄寄给十年后的你，"
         "看看那时的你听到它，会想起什么。\n\n"
         "十年很长，足够很多东西改变。但有些旋律会一直留在心里，"
         "像一枚不会褪色的书签。愿你听到它时，仍能会心一笑。",
         3650},
    };

    if (autoTitle)
        return capsules[arc4random_uniform(static_cast<uint32_t>(capsules.size()))];

    static const int64_t dayChoices[] = {30, 90, 180, 365};
    const int64_t days = dayChoices[arc4random_uniform(4)];
    const std::string content =
        "写下《" + title +
        "》这个标题的此刻，我希望未来的自己读到这段话时，能想起今天是怎样的心情。"
        "如果一切都顺利，那就笑一笑；如果有什么没有按预期发生，也不必懊恼——你只是又长大了一些。\n\n"
        "我不知道你现在在做什么，是不是还记得当下的那个细节：早晨的光线、桌上一杯还没喝完的水、"
        "正在听的那首歌、一句还没说出口的话。把这些寄给你，是因为它们值得被记住。\n\n"
        "记得照顾好自己，也记得对身边的人温柔一点。我们下次再见。";
    return {title, content, days};
}
