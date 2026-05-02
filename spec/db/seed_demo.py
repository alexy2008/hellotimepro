#!/usr/bin/env python3
"""
spec/db/seed_demo.py · HelloTime Pro 演示数据注入脚本

兼容 PostgreSQL 和 SQLite，幂等（演示用户已存在则跳过）。

连接配置优先级：
  1. 环境变量 DB_DRIVER / DB_URL
  2. data/.hello-state.json（hello webui 写入的运行时配置）
  3. 代码内置默认值

依赖（fastapi venv 已内置）：
  bcrypt>=4.0   sqlalchemy>=2.0   psycopg（postgres only）

用法：
  # 从 fastapi 目录用 uv run（推荐，依赖齐全）
  cd backends/fastapi && uv run python ../../spec/db/seed_demo.py

  # 或直接指定连接串
  DB_DRIVER=sqlite DB_URL=sqlite:///data/sqlite/hellotime.db python spec/db/seed_demo.py
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from pathlib import Path

import bcrypt
from sqlalchemy import create_engine, text

# ── 路径常量 ────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parents[2]
STATE_FILE = REPO_ROOT / "data" / ".hello-state.json"

DEMO_PASSWORD = "HelloTime2026!"
DEMO_EMAIL_MARKER = "demo.hellotimepro.dev"   # 用于幂等检查


# ── 连接配置 ────────────────────────────────────────────────────────────────

def _load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text()) if STATE_FILE.exists() else {}
    except (json.JSONDecodeError, OSError):
        return {}


def resolve_db_config() -> tuple[str, str]:
    """返回 (db_driver, db_url)，优先读 hello-state.json。"""
    state = _load_state()
    db_driver = os.environ.get("DB_DRIVER") or state.get("db_driver", "postgres")
    db_url = os.environ.get("DB_URL")

    if not db_url:
        cfg = state.get("db_config", {})
        if db_driver == "sqlite":
            sqlite_path = cfg.get("sqlite_path", "data/sqlite/hellotime.db")
            if not Path(sqlite_path).is_absolute():
                sqlite_path = str(REPO_ROOT / sqlite_path)
            Path(sqlite_path).parent.mkdir(parents=True, exist_ok=True)
            db_url = f"sqlite:///{sqlite_path}"
        else:
            host = cfg.get("pg_host", "127.0.0.1")
            port = cfg.get("pg_port", 5432)
            db   = cfg.get("pg_db",   "hellotime_pro")
            user = cfg.get("pg_user", "hellotime")
            pwd  = cfg.get("pg_pass", "hellotime")
            db_url = f"postgresql+psycopg://{user}:{pwd}@{host}:{port}/{db}"

    # 统一 SQLAlchemy scheme
    if db_driver != "sqlite":
        if db_url.startswith("postgres://"):
            db_url = "postgresql+psycopg" + db_url[8:]
        elif db_url.startswith("postgresql://"):
            db_url = "postgresql+psycopg" + db_url[13:]

    return db_driver, db_url


# ── UUID 格式化 ─────────────────────────────────────────────────────────────
# SQLAlchemy Uuid() 在 SQLite 里以 32 位无横线 hex 存储，PG 用标准格式。

def _uid(n: int, is_pg: bool) -> str:
    u = uuid.UUID(f"00000001-0000-0000-0000-{n:012d}")
    return str(u) if is_pg else u.hex


def _cid(n: int, is_pg: bool) -> str:
    u = uuid.UUID(f"00000002-0000-0000-0000-{n:012d}")
    return str(u) if is_pg else u.hex


# ── 主逻辑 ──────────────────────────────────────────────────────────────────

def seed(db_driver: str | None = None, db_url: str | None = None) -> None:
    if not db_driver or not db_url:
        db_driver, db_url = resolve_db_config()

    is_pg = db_driver != "sqlite"
    extra = {"check_same_thread": False} if not is_pg else {}
    engine = create_engine(db_url, connect_args=extra, future=True)

    with engine.begin() as conn:
        # 幂等检查
        count = conn.execute(
            text("SELECT count(*) FROM users WHERE email LIKE :pat"),
            {"pat": f"%@{DEMO_EMAIL_MARKER}"},
        ).scalar()
        if count and count > 0:
            print(f"↷  演示数据已存在（{count} 条匹配），跳过。")
            return

        print("→  注入演示数据…")

        # 密码哈希（每次随机 salt，均可验证 HelloTime2026!）
        h = [bcrypt.hashpw(DEMO_PASSWORD.encode(), bcrypt.gensalt(10)).decode()
             for _ in range(8)]

        # ── 用户 ──────────────────────────────────────────────────────────
        users = [
            (_uid(1, is_pg), "moxiang@demo.hellotimepro.dev",
             h[0], "暮光像素",       "nova",    "2025-08-01T01:00:00+00:00"),
            (_uid(2, is_pg), "laochenbug@demo.hellotimepro.dev",
             h[1], "老陈不想加班",   "circuit", "2025-08-31T16:00:00+00:00"),
            (_uid(3, is_pg), "ontheway@demo.hellotimepro.dev",
             h[2], "在路上的方",     "drift",   "2015-12-31T16:00:00+00:00"),
            (_uid(4, is_pg), "chenchen@demo.hellotimepro.dev",
             h[3], "晨晨赶考ing",    "pulse",   "2025-06-14T08:00:00+00:00"),
            (_uid(5, is_pg), "twokidsdad@demo.hellotimepro.dev",
             h[4], "两娃奶爸吴",     "neo",     "2016-03-14T08:00:00+00:00"),
            (_uid(6, is_pg), "chap7forever@demo.hellotimepro.dev",
             h[5], "永远第七章",     "oracle",  "2025-11-11T08:00:00+00:00"),
            (_uid(7, is_pg), "notprofitable@demo.hellotimepro.dev",
             h[6], "还没盈利的我",   "specter", "2025-03-31T16:00:00+00:00"),
            (_uid(8, is_pg), "teacherlaobo@demo.hellotimepro.dev",
             h[7], "退休班主任老白", "glyph",   "2025-08-31T16:00:00+00:00"),
        ]
        conn.execute(text("""
            INSERT INTO users
              (id, email, password_hash, nickname, avatar_id, created_at, updated_at)
            VALUES (:id, :email, :pw, :nick, :av, :ca, :ca)
        """), [{"id": u[0], "email": u[1], "pw": u[2],
                "nick": u[3], "av": u[4], "ca": u[5]} for u in users])

        # ── 胶囊 (19 枚) ──────────────────────────────────────────────────
        # (id, owner_id, code, title, content, open_at, in_plaza, fav, created_at)
        capsules = [
            # 已开启 (9 枚)
            (_cid(1,  is_pg), _uid(4, is_pg), "GRAD2025",
             "给一年后毕业纪念日的自己",
             "现在是凌晨两点，室友都睡着了，我把台灯调到最暗，坐在铺满答辩稿的床上写这封信。\n\n"
             "明天我就要走出这栋宿舍楼了。四年里我哭过三次——大一挂科、大三失恋、昨天拍毕业照。\n\n"
             "给一年后的自己留几个问题：\n"
             "1. 有没有找到真正喜欢的工作，不只是薪资还行的那种？\n"
             "2. 跟林阿姨推荐的那个男生见面了吗（我知道你很抗拒）？\n"
             "3. 攒够了去北海道的机票钱吗？\n\n"
             "如果这三件事一件都没做成，也没关系。你还有二十几岁的下半段。\n\n"
             "只是别忘记今晚这种感觉——什么都还没定，但什么都还来得及。",
             "2026-04-14T16:00:00+00:00", True, 1, "2025-06-14T16:00:00+00:00"),

            (_cid(2,  is_pg), _uid(2, is_pg), "DIET0901",
             "半年后，我体重几斤？",
             "今天 168 斤。朋友圈已经被健身房的人刷屏三年了，我终于也办了张卡。\n\n"
             "立一个 flag（虽然我知道以前全倒了）：\n"
             "- 3 个月减 10 斤\n- 6 个月减 15 斤\n- 能穿上 2020 年买的那件 L 码外套\n\n"
             "你现在打开这封信，请先去称一下体重，然后回来告诉我结果。\n\n"
             "不管多少斤，先给自己鼓个掌。坚持了半年，这件事本身就值得。\n\n"
             "（如果你根本没去健身……那我们就再开一个胶囊，继续约定。）",
             "2026-03-01T00:00:00+00:00", True, 0, "2025-09-01T00:00:00+00:00"),

            (_cid(3,  is_pg), _uid(3, is_pg), "TREK0715",
             "西藏回来的我，还是原来那个人吗",
             "明天我就要一个人去西藏了。不跟团，没有攻略，只有一个 65L 的包。\n\n"
             "说实话，我现在很害怕。不是怕高原反应，是怕发现自己根本就没有那么洒脱——"
             "路上遇到麻烦，我会不会想打电话让妈妈来接我？\n\n"
             "这五个月我想找到三个答案：\n"
             "一、我能不能在完全陌生的地方感到平静？\n"
             "二、孤独是我的选择，还是因为我不会跟人相处？\n"
             "三、自由旅行是我真正想要的生活，还是逃跑的借口？\n\n"
             "打开这封信的你，一定已经知道答案了。\n告诉我，那个答案让你失望了吗？",
             "2025-12-31T16:00:00+00:00", True, 1, "2025-07-15T01:00:00+00:00"),

            (_cid(4,  is_pg), _uid(7, is_pg), "BIZA0401",
             "HelloTime 创业一周年，我们还在吗",
             "今天公司执照下来了。就我一个人，租了个共享工位，座位费 800 块一个月。\n\n"
             "我不敢跟家里说要创业，只说“换了个工作”。\n\n"
             "一年后打开这封信，我想知道：\n"
             "- 团队有几个人？（我希望至少有 3 个）\n"
             "- 第一笔收入是多少？哪来的？\n"
             "- 有没有想过放弃？最后一次是什么时候？\n\n"
             "不管结果如何，今天的我很认真。\n\n"
             "我把这封信也发给了第一个员工——不管那时是谁，希望你知道，"
             "你加入的时候，我们什么都没有，但你来了。",
             "2026-04-01T08:00:00+00:00", True, 1, "2025-04-01T08:00:00+00:00"),

            (_cid(5,  is_pg), _uid(8, is_pg), "RETIR901",
             "适应了吗，老白？",
             "教了三十七年书，今天最后一次清空了讲台上的东西。\n\n"
             "学生们在操场给我办了欢送会，我笑着笑着就哭了，还得假装是迷了眼睛。\n\n"
             "现在回到家，突然不知道明天该做什么。三十七年来，我第一次不需要备课。\n\n"
             "半年后的我：\n"
             "有没有学会用那台平板？女儿说可以用它看书、刷视频、视频通话。\n"
             "有没有去社区老年大学报个国画班？\n"
             "早晨会不会还是六点就醒，然后发现不用去学校，心里是什么滋味？\n\n"
             "老白，慢下来没关系的。你已经很努力了。",
             "2026-03-01T00:00:00+00:00", True, 0, "2025-09-01T00:00:00+00:00"),

            (_cid(6,  is_pg), _uid(5, is_pg), "DAD16315",
             "吴小风，爸爸写给你的第一封信",
             "儿子，你现在 10 岁了。\n\n"
             "我写这封信的时候，你刚出生三天。我坐在医院走廊的塑料椅上，"
             "身上还是手术室那件衣服，等你妈妈醒来。\n\n"
             "那三天我没怎么睡，不是睡不着，是不敢睡——我怕错过你的每一个表情。\n\n"
             "你喜欢什么？踢球还是画画？喜欢看书还是打游戏？有没有要好的朋友？\n\n"
             "不管你是什么样的，我只想说一件事：你生下来那天，"
             "是我这辈子最害怕也最高兴的一天。\n\n"
             "不是因为你优不优秀，就只是因为你在。\n\n"
             "爸爸爱你。\n\n（等你长大了，记得带爸爸去一次你喜欢的地方。）",
             "2026-03-15T00:00:00+00:00", True, 5, "2016-03-15T08:00:00+00:00"),

            (_cid(7,  is_pg), _uid(6, is_pg), "STEAK214",
             "情人节早上打开：去年双 11 我做了什么",
             "今天是 11 月 11 日，零点整，我一个人在厨房煮了一锅红烧肉。\n\n"
             "做了两个小时，摆盘，拍了照片，然后……发现一个人根本吃不完。\n\n"
             "我把它放进冰箱，打开了这个 app，设定三个月后的情人节打开。\n\n"
             "如果你今天有人一起吃饭——恭喜你，你不一样了。\n"
             "如果你还是一个人——没关系，那锅红烧肉的食谱我可以再教你一次，两个人份的。\n\n"
             "人生里的很多事，都是先学会一个人做好，然后等人来一起分享。\n\n"
             "对了，冰箱里还有两块红烧肉，你去热一下吧。",
             "2026-02-14T00:00:00+00:00", True, 2, "2025-11-11T16:00:00+00:00"),

            (_cid(8,  is_pg), _uid(3, is_pg), "FUTURE16",
             "写给 2026 年读到这封信的陌生人",
             "你好，陌生人。\n\n"
             "我写这封信的时候是 2016 年，那时候微信刚开始流行，直播还是新鲜事，"
             "没有人知道疫情这个词。\n\n"
             "我不知道 10 年后的世界是什么样，但我猜你和我一样，还是会为了一些小事感到高兴"
             "——比如天气刚好，比如一杯好喝的咖啡，比如一个人突然给你发了条消息。\n\n"
             "我想问你一件事，不需要回答我，只需要你自己想一想：\n"
             "你现在做的事情，是你 10 年前的自己期待你去做的吗？\n\n"
             "不管答案是什么，都还来得及。\n\n来自 2016 年的我。",
             "2026-01-01T00:00:00+00:00", True, 3, "2016-01-01T08:00:00+00:00"),

            (_cid(9,  is_pg), _uid(4, is_pg), "EXAM1225",
             "成绩出来了，你上岸了吗",
             "今天考研最后一科结束了，走出考场的时候我的腿是软的。\n\n"
             "数学没发挥好。英语作文写偏了。但专业课感觉还行。\n\n"
             "现在的我不知道结果，只能等。\n\n"
             "如果你考上了：记得给复试备考留够时间，别因为上岸了就松懈。"
             "还要给辅导班的王老师发一条消息，她陪我熬过了整个暑假。\n\n"
             "如果你没考上：先哭，哭完了再想下一步。"
             "你不是第一次失败，你知道自己怎么站起来的。\n\n"
             "不管怎样，你在这里了。今天的你，比一年前的你努力很多。",
             "2026-03-20T00:00:00+00:00", True, 0, "2025-12-25T17:00:00+00:00"),

            # 未开启 (10 枚)
            (_cid(10, is_pg), _uid(1, is_pg), "HOME2601",
             "新家一周年，你把它变成家了吗",
             "搬家第一晚，我睡在空荡荡的新公寓地板上，因为床还没到。\n\n"
             "这是我第一套自己名字的房子。贷款。首付是妈妈帮的。"
             "我们约定好：我自己还，她不再催我找对象。\n\n"
             "一年后打开这封信，我想知道：\n"
             "- 那面主卧的白墙有没有挂上画？（我已经盯着它想了两个月）\n"
             "- 植物们都还活着吗？（我买了六盆，全是“好养活”的那种）\n"
             "- 有没有在这里请朋友吃过饭？\n\n"
             "一个地方变成家，不是因为住的时间久，是因为有了故事。\n\n"
             "希望一年后你能说，这里是家。",
             "2026-08-01T01:00:00+00:00", True, 0, "2025-08-01T01:00:00+00:00"),

            (_cid(11, is_pg), _uid(5, is_pg), "GIRL0812",
             "吴小鱼，你成年了",
             "小鱼，你今年 18 岁了。\n\n"
             "你 16 岁生日那天，我送了你一辆自行车，你嫌样式土。"
             "我们在饭桌上吵了一架，你摔门进了房间。\n\n"
             "我坐在客厅想了很久，不知道从什么时候开始，我开始不懂你了。\n\n"
             "现在的你有没有谅解我？我们有没有找到那种说话的方式——既是父女，也像朋友？\n\n"
             "不管怎样，我想告诉你几件事：\n"
             "一、你可以做任何你想做的事，我可以不理解，但我会在。\n"
             "二、那辆自行车我还放在车库，如果你哪天想骑……\n"
             "三、我爱你，即使我不总是说出口。\n\n生日快乐，小鱼。",
             "2026-08-12T00:00:00+00:00", True, 0, "2024-08-12T08:00:00+00:00"),

            (_cid(12, is_pg), _uid(6, is_pg), "NOVEL031",
             "2031 年，那本书写完了吗",
             "今天把第一章发给了写作群的朋友，他们说“很有意思，继续写”。\n\n"
             "我已经“继续写”了三年，依然停在第七章。\n\n"
             "给五年后的自己设一个问题：那本书，最后写完了吗？\n\n"
             "如果写完了——不管有没有出版，你都已经做到了一件很多人一辈子没做到的事。\n\n"
             "如果还没写完——是什么卡住了你？\n\n"
             "如果你早就放弃了——那你现在在做什么？有没有一件新的事，让你同样认真？\n\n"
             "这个世界不缺少好故事，缺少的是把它写完的人。希望你是那种人。\n\n"
             "（第七章的梗我想好了，就是不知道怎么写。如果你还记得，帮过去的我想一想。）",
             "2031-04-15T08:00:00+00:00", True, 0, "2026-04-15T08:00:00+00:00"),

            (_cid(13, is_pg), _uid(7, is_pg), "BIZ3YEAR",
             "三年了，还在做这件事吗",
             "公司成立三年了。我在今天写下这封信，不是因为什么里程碑，"
             "就是突然觉得需要记录一下此刻。\n\n"
             "团队现在有 11 个人，刚完成了一轮天使轮融资，产品还在打磨期，"
             "每天都有我搞不定的事。\n\n"
             "三年后的公司：\n"
             "- 还在做同一件事吗？\n- 核心团队有几个人坚持下来了？\n"
             "- 用户有没有说过一句让你觉得值了的话？\n\n"
             "不管你们走到哪里，我想说：最开始只是我一个人，在一个 800 块的工位上，"
             "想做一件很多人说做不到的事。\n\n你们，就是那个证明。",
             "2029-04-01T08:00:00+00:00", True, 0, "2026-04-01T08:00:00+00:00"),

            (_cid(14, is_pg), _uid(2, is_pg), "ALUMNI15",
             "大学毕业 15 年，我们还是朋友吗",
             "昨晚跟大学室友视频，聊了三个小时。最后他说“等哪天聚聚”，"
             "我们都知道这句话的意思——可能是三年后，可能是十年后，可能再也没有。\n\n"
             "我们都有了各自的生活。他在杭州，我在北京，另外两个一个出国一个回老家了。\n\n"
             "10 年后打开这封信的我，我想问：\n你上一次见他们是什么时候？\n\n"
             "如果超过五年了——去联系他们，现在就去。不要等哪天，就是今天。\n\n"
             "如果你们还有联系——发给他们看看这封信，告诉他们，2026 年的你在想他们。",
             "2036-04-20T08:00:00+00:00", True, 0, "2026-04-20T08:00:00+00:00"),

            (_cid(15, is_pg), _uid(3, is_pg), "JAPAN027",
             "一年后，日本那段路走了吗",
             "今天买好了去日本的机票，四国岛遍路——1200 公里的朝圣之路，古人走完要 50 天。\n\n"
             "我没有信仰，但我需要那 50 天的安静。\n\n"
             "一年后的我：\n真的走了吗？还是又被别的事推迟了？\n\n"
             "如果走了：那 50 天里，有没有一个时刻，你不想继续了，但还是继续了？\n"
             "如果没走：你用什么代替了它？\n\n"
             "有些路不走，永远不知道自己能不能走完。\n"
             "有些话不说，时间一长，自己都忘了。\n\n我把这两件事都做了。",
             "2027-04-28T08:00:00+00:00", True, 0, "2026-04-28T08:00:00+00:00"),

            (_cid(16, is_pg), _uid(8, is_pg), "MEMOIR28",
             "两年后，那本回忆录开始写了吗",
             "同事劝我把三十七年的教学故事写下来，说一定有人想看。\n\n"
             "我一直说“等退休”。退休了，又说“等适应了”。\n\n"
             "现在我给自己两年时间。\n\n"
             "两年后打开这封信，如果你还没开始写——就今天开始。\n"
             "不需要章节，不需要逻辑，先把你记得最清楚的那个学生写出来。就一个。\n\n"
             "那个孩子叫刘大强，1997 年入学，上课睡觉，毕业三年后给我寄来了他写的第一本书，"
             "扉页上写：谢谢您当年没有放弃我。\n\n"
             "他值得被记录下来。还有很多像他一样的孩子。\n\n老白，动笔吧。",
             "2028-01-01T00:00:00+00:00", True, 0, "2026-01-01T00:00:00+00:00"),

            (_cid(17, is_pg), _uid(4, is_pg), "NY270101",
             "2027 年的你，兑现了多少？",
             "今天是 2026 年第一天，我给自己列了个清单：\n\n"
             "□ 考研结果出了就接受，不管上没上\n"
             "□ 学会做一道拿手菜\n"
             "□ 和爸妈好好说一次谢谢\n"
             "□ 写完那篇一直没写完的短篇小说\n"
             "□ 存够 3 万块\n"
             "□ 把手机用量从每天 6 小时降到 3 小时\n\n"
             "去年的清单一条都没兑现。但这次认真的。\n\n"
             "一年后打开这封信，在清单上打勾，哪怕只有一条也算赢。",
             "2027-01-01T00:00:00+00:00", True, 0, "2026-01-01T00:00:00+00:00"),

            (_cid(18, is_pg), _uid(1, is_pg), "LOVE2028",
             "两年后情人节，你身边有人了吗",
             "今天情人节，我一个人去看了场电影。\n\n"
             "不是因为伤心，只是……不知道什么感觉。好像有什么东西在等，但不知道等什么。\n\n"
             "写这封信不是给现在的自己，是给还没出现的那个人，也给两年后看到这封信时的自己。\n\n"
             "如果你现在已经有人了：告诉他/她，有一个 25 岁的你，在一个情人节的晚上，"
             "一个人看完了电影，然后回家，相信他/她会出现。\n\n"
             "如果你还是一个人：你没有亏欠任何人什么。"
             "你一个人的日子过得很好，这件事本身就很了不起。\n\n"
             "不管如何，你值得被爱。这件事不需要等别人来证明。",
             "2028-02-14T00:00:00+00:00", True, 0, "2026-02-14T08:00:00+00:00"),

            (_cid(19, is_pg), _uid(6, is_pg), "PLAZA430",
             "四年后读到这行字的人，你好",
             "你好，陌生人。\n\n"
             "我不知道 2030 年的世界是什么样。这个 app 还在用吗，还是已经成了一段记忆？\n\n"
             "如果你还在用它——说明有些东西没有变：人还是想把话说出去，"
             "然后让时间帮忙藏着，等到某一天，再轻轻还回来。\n\n"
             "我在 2026 年写这封信，很普通的一天，北京下了小雨，"
             "我喝了两杯茶，把想说的话埋进了时间里。\n\n"
             "希望你打开的这一天也不错。\n\n或者就算不好，也还好。",
             "2030-04-30T08:00:00+00:00", True, 0, "2026-04-30T08:00:00+00:00"),
        ]
        conn.execute(text("""
            INSERT INTO capsules
              (id, owner_id, code, title, content,
               open_at, in_plaza, favorite_count, created_at, updated_at)
            VALUES
              (:id, :owner, :code, :title, :content,
               :open_at, :plaza, :fav, :ca, :ca)
        """), [
            {"id": c[0], "owner": c[1], "code": c[2], "title": c[3],
             "content": c[4], "open_at": c[5], "plaza": c[6],
             "fav": c[7], "ca": c[8]}
            for c in capsules
        ])

        # ── 收藏 ─────────────────────────────────────────────────────────
        favorites = [
            (_uid(1, is_pg), _cid(6,  is_pg), "2026-03-15T10:00:00+00:00"),
            (_uid(1, is_pg), _cid(8,  is_pg), "2026-01-02T09:00:00+00:00"),
            (_uid(2, is_pg), _cid(4,  is_pg), "2026-04-02T08:00:00+00:00"),
            (_uid(3, is_pg), _cid(7,  is_pg), "2026-02-14T10:00:00+00:00"),
            (_uid(3, is_pg), _cid(6,  is_pg), "2026-03-16T08:00:00+00:00"),
            (_uid(4, is_pg), _cid(8,  is_pg), "2026-01-03T14:00:00+00:00"),
            (_uid(5, is_pg), _cid(8,  is_pg), "2026-01-05T09:00:00+00:00"),
            (_uid(6, is_pg), _cid(3,  is_pg), "2026-01-01T20:00:00+00:00"),
            (_uid(6, is_pg), _cid(6,  is_pg), "2026-03-15T12:00:00+00:00"),
            (_uid(7, is_pg), _cid(1,  is_pg), "2026-04-14T18:00:00+00:00"),
            (_uid(7, is_pg), _cid(6,  is_pg), "2026-03-15T11:00:00+00:00"),
            (_uid(8, is_pg), _cid(6,  is_pg), "2026-03-15T16:00:00+00:00"),
            (_uid(8, is_pg), _cid(7,  is_pg), "2026-02-15T08:00:00+00:00"),
        ]
        conn.execute(text("""
            INSERT INTO favorites (user_id, capsule_id, created_at)
            VALUES (:u, :c, :ca)
        """), [{"u": f[0], "c": f[1], "ca": f[2]} for f in favorites])

    print("✓  演示数据注入完成：8 用户 / 19 胶囊 / 13 收藏")
    print(f"   密码均为: {DEMO_PASSWORD}")


if __name__ == "__main__":
    driver, url = resolve_db_config()
    print(f"  DB_DRIVER = {driver}")
    print(f"  DB_URL    = {url}")
    try:
        seed(driver, url)
    except Exception as exc:
        print(f"✗  注入失败: {exc}", file=sys.stderr)
        sys.exit(1)
