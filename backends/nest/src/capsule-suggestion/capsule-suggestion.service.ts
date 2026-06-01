import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { AppConfig } from '../config/configuration';
import { LlmClientService } from '../llm/llm-client.service';

/** 空标题模式下的本地兜底主题池：每条为 [title, content, openInDays]。 */
const FALLBACK_CAPSULES: Array<[string, string, number]> = [
  [
    '写给一个月后的自己',
    '此刻的我有点想对一个月后的你说说话。不知道那时的天气怎么样，你手边在忙些什么，' +
      '有没有把现在挂在心上的那件小事做完。我想记住今天的样子：略显疲惫，却还愿意期待。\n\n' +
      '如果这一个月过得顺利，那就好好奖励自己一次；如果有些计划落了空，也别太苛责，' +
      '你已经在往前走了。记得多喝水，记得早点睡，记得偶尔抬头看看窗外。我们一个月后见。',
    30,
  ],
  [
    '下个季度想完成的一件事',
    '我想把一件一直拖着的事认真做完，所以把它写进这封信里，让未来的你来检查。' +
      '现在的我还在犹豫，担心做不好，担心时间不够；但比起完美，我更怕一直停在原地。\n\n' +
      '等你读到这段话时，希望那件事已经有了眉目——哪怕只是迈出了第一步。' +
      '无论结果如何，请记得为当初愿意开始的自己鼓一次掌。',
    90,
  ],
  [
    '猜猜下届世界杯冠军是谁',
    '趁着还没揭晓，我想先把心里押注的那支球队写下来，等结果出来再回头验证我的眼光。' +
      '此刻的我对足球的热情正浓，会为一个进球大喊，也会为一次失误叹气。\n\n' +
      '等这封信开启的时候，冠军应该已经诞生了吧。不管我猜得对不对，' +
      '希望那段为热爱呐喊的日子，依然让你觉得值得。',
    365,
  ],
  [
    '明年生日想对自己说的话',
    '又长了一岁的你，过得还好吗？我在今天提前为你写下这封信，想问问你有没有变成' +
      '自己喜欢的样子。也许你完成了一些心愿，也许还有遗憾，但这都没关系。\n\n' +
      '请记得今天的心情：对未来既忐忑又期待。生日快乐，愿你被爱，也愿你爱人。',
    365,
  ],
  [
    '三年后还在做喜欢的事吗',
    '三年说长不长，说短不短。我把现在最热爱的事写下来，想知道未来的你有没有把它坚持下去。' +
      '此刻它带给我很多快乐，也带来一些迷茫。\n\n' +
      '如果你还在做它，恭喜你守住了热爱；如果换了方向，也希望那是更适合你的选择。' +
      '无论如何，别忘了当初让你眼睛发亮的那个瞬间。',
    1095,
  ],
  [
    '五年后的我在哪座城市',
    '我常常好奇五年后会在哪里醒来：是熟悉的故乡，还是某个还没去过的城市？' +
      '此刻的我对未来有许多想象，也有一点不安。\n\n' +
      '等你打开这封信，请替现在的我看看窗外——那是我们一起走到的地方。' +
      '不管落脚在哪，希望你过得踏实、自在。',
    1825,
  ],
  [
    '十年后还在听同一首歌吗',
    '现在循环播放的那首歌，几乎成了这段日子的背景音。我想把它悄悄寄给十年后的你，' +
      '看看那时的你听到它，会想起什么。\n\n' +
      '十年很长，足够很多东西改变。但有些旋律会一直留在心里，' +
      '像一枚不会褪色的书签。愿你听到它时，仍能会心一笑。',
    3650,
  ],
];

@Injectable()
export class CapsuleSuggestionService {
  private readonly logger = new Logger(CapsuleSuggestionService.name);

  constructor(
    private readonly config: ConfigService<AppConfig>,
    private readonly llm: LlmClientService,
  ) {}

  private promptTemplate(): string {
    const repoRoot = this.config.get('repoRoot', { infer: true }) ?? process.cwd();
    const promptPath = path.join(repoRoot, 'spec', 'llm', 'capsule-suggestion.prompt.md');
    try {
      return fs.readFileSync(promptPath, 'utf-8');
    } catch {
      return (
        '你是中文写作助手。胶囊标题为 {TITLE_OR_EMPTY}（可能为空，为空时请先构思一个 1~18 字' +
        '中文标题）。为用户生成一段 260~400 字的时光胶囊正文（content），并给出建议的开启天数' +
        '（openInDays，1~3650 整数）。只返回严格 JSON：{"title":"...","content":"...","openInDays":30}。'
      );
    }
  }

  private buildPrompt(title: string): string {
    // title 为空字符串即"空标题模式"，由 LLM 自行构思标题。
    return this.promptTemplate().replace('{TITLE_OR_EMPTY}', title).replace('{TITLE}', title);
  }

  private coerceOpenInDays(raw: unknown): number {
    let days: number;
    if (typeof raw === 'boolean') throw new Error('openInDays must be integer');
    if (typeof raw === 'number') days = Math.round(raw);
    else if (typeof raw === 'string') days = parseInt(raw, 10);
    else throw new Error('openInDays must be integer');
    if (isNaN(days)) throw new Error('openInDays is NaN');
    return Math.min(3650, Math.max(1, days));
  }

  private truncateTitle(text: string): string {
    let cleaned = String(text).trim().replace(/[\r\n]+/g, ' ');
    cleaned = cleaned.replace(/^[#*`　 "'《》【】]+|[#*`　 "'《》【】]+$/g, '').trim();
    return [...cleaned].slice(0, 60).join('');
  }

  /** 本地兜底，返回 [title, content, openInDays]。 */
  private localFallback(autoTitle: boolean, title: string): [string, string, number] {
    if (autoTitle) {
      return FALLBACK_CAPSULES[Math.floor(Math.random() * FALLBACK_CAPSULES.length)];
    }
    const dayOptions = [30, 90, 180, 365];
    const openInDays = dayOptions[Math.floor(Math.random() * dayOptions.length)];
    const content =
      `写下《${title}》这个标题的此刻，我希望未来的自己读到这段话时，能想起今天是怎样的心情。` +
      '如果一切都顺利，那就笑一笑；如果有什么没有按预期发生，也不必懊恼——你只是又长大了一些。\n\n' +
      '我不知道你现在在做什么，是不是还记得当下的那个细节：早晨的光线、桌上一杯还没喝完的水、' +
      '正在听的那首歌、一句还没说出口的话。把这些寄给你，是因为它们值得被记住。\n\n' +
      '记得照顾好自己，也记得对身边的人温柔一点。我们下次再见。';
    return [title, content, openInDays];
  }

  async suggest(rawTitle?: string) {
    const title = (rawTitle ?? '').trim();
    const autoTitle = title === '';
    const provider = this.config.get('llmProvider', { infer: true }) ?? 'openai';
    const model = this.config.get('llmModel', { infer: true }) ?? 'gpt-4.1-mini';

    let resultTitle: string | undefined;
    let content = '';
    let openInDays = 0;
    let generatedBy = 'local-template';
    let ok = false;

    try {
      const llmResult = await this.llm.generateSuggestion(this.buildPrompt(title));
      const text = String(llmResult.content ?? '').trim().slice(0, 5000);
      const days = this.coerceOpenInDays(llmResult.openInDays);
      if (!text) throw new Error('empty content from LLM');
      let genTitle: string | undefined;
      if (autoTitle) {
        genTitle = this.truncateTitle(String(llmResult.title ?? ''));
        if (!genTitle) throw new Error('empty title from LLM in auto-title mode');
      }
      content = text;
      openInDays = days;
      if (autoTitle) resultTitle = genTitle;
      generatedBy = `${provider}:${model}`;
      ok = true;
    } catch (e) {
      this.logger.warn(`Capsule suggestion LLM failed; using local fallback: ${e}`);
    }

    if (!ok) {
      const [fbTitle, fbContent, fbDays] = this.localFallback(autoTitle, title);
      content = fbContent;
      openInDays = fbDays;
      if (autoTitle) resultTitle = fbTitle;
    }

    const openAt = new Date(Date.now() + openInDays * 86400 * 1000);
    return {
      ...(resultTitle ? { title: resultTitle } : {}),
      content,
      openInDays,
      openAt,
      generatedBy,
      cached: false,
    };
  }
}
