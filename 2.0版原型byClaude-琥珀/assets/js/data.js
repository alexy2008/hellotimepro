/* ============================================================
   HelloTime Pro · 2.0 原型 · 模拟数据
   ------------------------------------------------------------
   原型不连后端。这里的数据形状与 spec/api/openapi.yaml 对齐，
   时间一律用「相对首次打开原型的那一刻（epoch）」的天数表示，
   这样无论哪天打开，倒计时都是有意义的。
   ============================================================ */
(function (HT) {
  'use strict';

  /* ---------- 内置头像：沿用 spec/avatars 的 10 个 id，按新风格重绘为单线徽记 ---------- */
  HT.AVATARS = [
    { id: 'neo', name: '新生', tagline: '破土的芽', color: '#4A7C59',
      glyph: '<path d="M12 20.5v-9"/><path d="M12 13.5c-4.2.3-6.6-2-6.8-6.2 4.2-.3 6.6 2 6.8 6.2z"/><path d="M12 11c.2-3.6 2.3-5.6 6-5.8-.2 3.6-2.3 5.6-6 5.8z"/>' },
    { id: 'specter', name: '幽影', tagline: '夜里的访客', color: '#7A6A9C',
      glyph: '<path d="M6 20.5V11a6 6 0 0 1 12 0v9.5l-2-1.6-2 1.6-2-1.6-2 1.6-2-1.6-2 1.6z"/><circle cx="9.8" cy="11.2" r="1" fill="currentColor" stroke="none"/><circle cx="14.2" cy="11.2" r="1" fill="currentColor" stroke="none"/>' },
    { id: 'glyph', name: '符文', tagline: '未解的记号', color: '#2F607F',
      glyph: '<circle cx="12" cy="12" r="8.5"/><path d="M12 6.5 17.5 12 12 17.5 6.5 12z"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>' },
    { id: 'pulse', name: '心跳', tagline: '此刻的证据', color: '#B24A5C',
      glyph: '<path d="M2.5 12.5h4l2.2-5.5 3.3 10.5 3-8 1.6 3h4.9"/>' },
    { id: 'circuit', name: '电路', tagline: '有序的远方', color: '#3B7C76',
      glyph: '<rect x="7.5" y="7.5" width="9" height="9" rx="1.5"/><path d="M10 3.5v4M14 3.5v4M10 16.5v4M14 16.5v4M3.5 10h4M3.5 14h4M16.5 10h4M16.5 14h4"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>' },
    { id: 'nova', name: '新星', tagline: '迟到的光', color: '#B07F24',
      glyph: '<path d="M12 3l1.9 7.1L21 12l-7.1 1.9L12 21l-1.9-7.1L3 12l7.1-1.9z"/>' },
    { id: 'oracle', name: '神谕', tagline: '看向以后', color: '#444F92',
      glyph: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r=".9" fill="currentColor" stroke="none"/>' },
    { id: 'drift', name: '漂流', tagline: '随水而去', color: '#66757F',
      glyph: '<path d="M3 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M3 12.5c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M3 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>' },
    { id: 'echo', name: '回声', tagline: '山谷的答复', color: '#A3613A',
      glyph: '<circle cx="6.5" cy="12" r="1.4" fill="currentColor" stroke="none"/><path d="M10 8.8a4.6 4.6 0 0 1 0 6.4"/><path d="M13.2 6a8.6 8.6 0 0 1 0 12"/><path d="M16.4 3.4a12.6 12.6 0 0 1 0 17.2"/>' },
    { id: 'void', name: '深渊', tagline: '安静的中心', color: '#3A3944',
      glyph: '<circle cx="12" cy="12" r="8.5" stroke-dasharray="1.5 3"/><circle cx="12" cy="12" r="4.6" fill="currentColor" stroke="none"/>' },
  ];

  /* ---------- 用户 ---------- */
  HT.USERS = {
    aqing:    { id: 'u-aqing',    nickname: '阿青',     avatarId: 'neo' },
    linshen:  { id: 'u-linshen',  nickname: '林深',     avatarId: 'oracle' },
    wanfeng:  { id: 'u-wanfeng',  nickname: '晚风',     avatarId: 'drift' },
    xiaoman:  { id: 'u-xiaoman',  nickname: '小满',     avatarId: 'nova' },
    zhouzhou: { id: 'u-zhouzhou', nickname: '周周',     avatarId: 'pulse' },
    mori:     { id: 'u-mori',     nickname: 'Mori',     avatarId: 'specter' },
    beidao:   { id: 'u-beidao',   nickname: '北岛以北', avatarId: 'echo' },
    qiyue:    { id: 'u-qiyue',    nickname: '七月',     avatarId: 'glyph' },
    shanzhi:  { id: 'u-shanzhi',  nickname: '山止川行', avatarId: 'void' },
    kiko:     { id: 'u-kiko',     nickname: 'kiko',     avatarId: 'circuit' },
    chenpi:   { id: 'u-chenpi',   nickname: '陈皮',     avatarId: 'pulse' },
    ashu:     { id: 'u-ashu',     nickname: '阿树',     avatarId: 'glyph' },
  };

  /* 演示账号：登录页可一键填入 */
  HT.DEMO_ACCOUNT = { email: 'aqing@hellotime.dev', password: 'hello2026', userKey: 'aqing', joinedDaysAgo: 259 };

  /* ---------- 胶囊种子 ----------
     created / open：相对 epoch 的天数（负 = 过去，正 = 未来）；openAbs：绝对日期（本地时区） */
  HT.SEEDS = [
    /* —— 已启封 —— */
    { id: 'c01', code: 'GK25WIND', by: 'linshen', title: '高考结束那天的晚风', created: -372, open: -7, fav: 342, plaza: true,
      content: `走出考场的时候，天还没黑。校门口挤满了举着花的家长，我绕开人群，一个人走到操场，在看台最高的那一排坐了很久。

晚风把试卷的味道一点点吹散了。我忽然意识到，以后再也不会有人替我把每一天切成四十五分钟。

现在的你在哪里？是不是已经习惯了没有晚自习的夜晚？有没有交到可以一起吃宵夜的朋友？

不管考得怎么样，我都想告诉你：那个在看台上吹风的人，已经尽力了。别回头责怪他。

如果这一年过得不太顺，就回操场走一圈吧。风应该还是那阵风。` },
    { id: 'c02', code: 'BEIJING1', by: 'wanfeng', title: '给一年后还在北京的我', created: -366, open: -1.2, fav: 256, plaza: true,
      content: `今天是搬进五环外这间次卧的第三天。通勤一个小时二十分钟，我在地铁上学会了站着睡觉。

房东留下一盆快死的绿萝，我给它换了水，摆在唯一照得到太阳的窗台上。我和它约好：它活着，我就不走。

一年后的你，如果还在北京——绿萝还在吗？工资涨了吗？有没有找到一家愿意常去的面馆？

如果你已经离开了，也没关系。那不叫认输，只是换了一条路回家。

记得给妈妈打电话。她嘴上说不想你，其实每天都在看北京的天气预报。` },
    { id: 'c03', code: 'GUIHUA24', by: 'xiaoman', title: '外婆的桂花糕做法', created: -400, open: -35, fav: 418, plaza: true,
      content: `趁外婆还记得，我把做法一句一句记了下来。

糯米粉和粘米粉，七比三。糖桂花要用她自己腌的那一罐，罐子在橱柜最上层，贴着一张褪了色的「福」字。水要一点一点加，她说「手握成团，一碰就散」，就是刚刚好。

上锅蒸二十分钟，不许掀盖子。掀了，糕就「泄气」了。

外婆说这些的时候，一直在笑我笨。

明年桂花开的时候，照着这个方子做一次吧。做坏了也没关系，她说过，第一锅本来就是给灶王爷吃的。` },
    { id: 'c04', code: 'WORLDCUP', by: 'zhouzhou', title: '猜猜这届世界杯谁夺冠', created: -160, open: -112, fav: 205, plaza: true,
      content: `开赛前夜，立字为据。

我押法国。理由很不专业：他们今年的球衣最好看。

阿哲押巴西。输了的人请吃一个月的宵夜，烧烤不算，必须是正经火锅。

打开这封信的时候，冠军应该早就捧过杯了。如果我押对了，请立刻把这封信截图发到群里，标题就叫《论审美的胜利》。

如果押错了……那就假装没有写过这封信吧。` },
    { id: 'c05', code: 'NEWHOME1', by: 'mori', title: '搬进新家的第一个晚上', created: -200, open: -20, fav: 73, plaza: true,
      content: `屋子里还全是纸箱，床垫直接铺在地上。没有窗帘，对面楼的灯一盏一盏亮起来，像有人在很远的地方替我点了一排蜡烛。

我煮了一包泡面，坐在纸箱上吃完，觉得这是今年吃过最好吃的一顿。

以后这里会有沙发、书架、一张够六个人吃饭的桌子。会有猫，也可能没有。

想让你记住今晚这种空荡荡的高兴。等房子被生活填满之后，偶尔也把东西挪开一点，给自己留一块空地。` },
    { id: 'c06', code: 'RESIGN01', by: 'beidao', title: '写在辞职那天', created: -380, open: -15, fav: 189, plaza: true,
      content: `下午四点十七分，我按下了发送键。

工位上的仙人掌送给了隔壁的实习生。她问我为什么走，我说想看看工作日下午三点的公园是什么样子。

其实是害怕的。存款只够撑八个月，简历上会多出一段说不清楚的空白。

所以我想问一年后的你：后悔吗？

如果后悔，这封信就是证据，证明当时的你是认真想过的。如果不后悔——那就请你替现在这个手心出汗的人，好好地高兴一下。` },
    { id: 'c07', code: 'SOLO0001', by: 'qiyue', title: '第一次独自旅行前夜', created: -6.4, open: -1.6, fav: 97, plaza: true,
      content: `背包已经收拾好了，立在门口，像一只等着出门的小狗。

攻略做了三版，最后决定一版都不带。只在手机里存了一句话：迷路的时候，就往有水的方向走。

有点紧张。怕一个人吃饭，怕拍照没人帮忙，怕在陌生的城市里生病。

但更怕的是，一直等到「有人陪」才出发。

回来之后告诉我：一个人看到的海，是不是也一样蓝？` },
    { id: 'c08', code: 'NOBOBA30', by: 'kiko', title: '30 天不喝奶茶挑战', created: -33, open: -3, fav: 45, plaza: true,
      content: `立此存照：从今天起，三十天，一杯都不喝。

包括但不限于：珍珠、芋泥、杨枝甘露，以及「就喝一口」。

如果你打开这封信的时候挑战成功了，请奖励自己一杯全糖的。如果失败了——失败在第几天？我赌是第九天，周五，下午四点。

不管怎样，省下来的钱够买那双看了很久的鞋了吧。` },
    { id: 'c09', code: 'CAT00100', by: 'chenpi', title: '猫到家的第一百天', created: -2.6, open: -0.09, fav: 61, plaza: true,
      content: `它来的第一天躲在沙发底下，整整十四个小时没出来。我趴在地上跟它说了半宿的话，像个傻子。

今天是第一百天。它现在睡在我的键盘上，这封信有三行是它踩出来的，我删掉了。

想记下来的事：它喜欢纸箱胜过猫窝，喜欢凌晨四点跑酷，喜欢在我难过的时候假装路过。

以后的日子，请你继续做一个合格的开罐头的人。` },

    /* —— 演示账号「阿青」的胶囊 —— */
    { id: 'c10', code: 'THIRTY30', by: 'aqing', title: '写给三十岁的自己', created: -120, open: 975, fav: 128, plaza: true,
      content: `你好，三十岁的我。

写这封信的时候我二十七，刚刚学会不在深夜做决定。

想问你几个问题：还在写东西吗？和爸妈的通话有没有超过十分钟？那个一直想去的地方，去了没有？

如果答案都是「没有」，也别太难过。至少你打开了这封信，说明你还记得，自己曾经认真地期待过。` },
    { id: 'c11', code: 'HANGZHOU', by: 'aqing', title: '搬来杭州的第一年', created: -258, open: -48, fav: 87, plaza: true,
      content: `西湖去了三次，三次都在下雨。同事说这才是对的，晴天的西湖是给游客看的。

这一年学会了几件事：骑车上班，认得出五种以上的茶，以及在梅雨季把衣服烘干。

也有几件没学会的：还是听不懂本地话，还是会在深夜想念北方的暖气。

写下这封信，是想问问一年后的自己——你开始把这里叫作「家」了吗？` },
    { id: 'c12', code: 'MEMO4ME1', by: 'aqing', title: '只给自己看的备忘', created: -14, open: 76, fav: 0, plaza: false,
      content: `三件事，别忘了：

体检报告要复查；欠阿树一顿饭；以及，你其实没有自己以为的那么糟。` },
    { id: 'c13', code: 'HALF2110', by: 'aqing', title: '跑完人生第一个半马', created: -210, open: -30, fav: 0, plaza: false,
      content: `两小时十九分。最后三公里是走完的，但我没有停。

十七公里的地方有个小朋友举着牌子，上面写着「陌生人，你真棒」。我就是在那里哭的。

只给自己看：下次想放弃一件事的时候，想想十七公里的那块牌子。` },

    /* —— 未启封 —— */
    { id: 'c14', code: 'SAMESONG', by: 'wanfeng', title: '十年后还在听同一首歌吗', created: -40, open: 3610, fav: 512, plaza: true,
      content: `此刻单曲循环的那首歌，前奏一响，我就会想起这个冬天的出租屋。

歌名写在信纸的背面，不告诉任何人。十年后的你，先别急着翻过去——哼一下，看还记不记得旋律。` },
    { id: 'c15', code: 'AGE18KID', by: 'shanzhi', title: '等孩子十八岁再打开', created: -300, open: 1930, fav: 388, plaza: true,
      content: `你今天第一次自己走了七步，然后一屁股坐在地上，笑得比谁都大声。

等你十八岁，我想把这七步讲给你听。到那时你大概会嫌我啰嗦，没关系，嫌吧。` },
    { id: 'c16', code: 'Y2030NEW', by: 'qiyue', title: '2030 年的第一天', created: -52, openAbs: [2030, 1, 1, 0, 0], fav: 274, plaza: true,
      content: `新年好。

写信的人在一个暖气不太热的冬天，对你那边的世界很好奇：车会自己开了吗？我们还在用手机吗？

最要紧的是——你，过得好吗？` },
    { id: 'c17', code: 'CLASS5YR', by: 'linshen', title: '毕业五周年聚会上念', created: -600, open: 220, fav: 166, plaza: true,
      content: `各位，如果这封信被念出来了，说明我们真的凑齐了。

请替我看看：谁的发际线守住了，谁真的开了那家店，谁还留着毕业那天的合照当屏保。` },
    { id: 'c18', code: 'MOVE0002', by: 'mori', title: '下一次搬家时提醒自己', created: -18, open: 90, fav: 31, plaza: true,
      content: `别再买书架了。真的。

你上次搬家的时候，对着电梯口的十二箱书发过誓。` },
    { id: 'c19', code: 'BDAY2027', by: 'xiaoman', title: '给明年生日的我', created: -164, open: 201, fav: 84, plaza: true,
      content: `生日快乐。

今年许的愿望写在这里：希望家里人都平安，希望自己的胆子再大一点。明年的你来验收。` },
    { id: 'c20', code: 'RUN42195', by: 'zhouzhou', title: '马拉松完赛之后', created: -62, open: 28, fav: 59, plaza: true,
      content: `如果你完赛了，这封信就是奖牌之外的第二份奖励。

如果没有——明年再来，信我替你留着。` },
    { id: 'c21', code: 'TENYEARS', by: 'beidao', title: '结婚十周年那天一起看', created: -420, open: 2560, fav: 301, plaza: true,
      content: `今天你把戒指戴反了，自己都没发现。

我没有提醒你，想留到十年后再笑话你。` },
    { id: 'c22', code: 'WISH2027', by: 'kiko', title: '新年愿望存档 · 2027', created: -7, openAbs: [2027, 12, 31, 20, 0], fav: 143, plaza: true,
      content: `一、存下第一个十万。
二、学会游泳。
三、少说「随便」。

年底打开，逐条对账。` },
    { id: 'c23', code: 'GINKGO09', by: 'chenpi', title: '等这棵银杏黄了', created: -11, open: 9, fav: 22, plaza: true,
      content: `楼下的银杏今年黄得晚。

和它打个赌：它全黄的那天，我就去剪头发。` },
    { id: 'c24', code: 'KAOYAN27', by: 'ashu', title: '考研上岸后再看', created: -75, open: 130, fav: 77, plaza: true,
      content: `图书馆四楼靠窗的位置，今天又被我占到了。

等你上岸，回来在这张桌子上刻个……算了，别刻，拍张照就好。` },
    { id: 'c25', code: 'SEEYOU3M', by: 'kiko', title: '三分钟后见', created: -0.002, open: 0.0021, fav: 9, plaza: true,
      content: `嗨，这是一枚只等三分钟的胶囊。

写它是想告诉你：等待本身，也是礼物的一部分。` },
    { id: 'c26', code: 'BABY2027', by: 'shanzhi', title: '给还没出生的你', created: -28, open: 150, fav: 233, plaza: true,
      content: `预产期在春天。

我们还没想好你的名字，但已经给你留好了靠窗的那个房间。` },
    { id: 'c27', code: 'RAIN1115', by: 'mori', title: '存一段今天的雨声', created: -0.4, open: 3.17, fav: 18, plaza: true,
      content: `下午三点，雨打在空调外机上，像有人在很耐心地敲门。

我什么都没做，只是听了四十分钟。` },
    { id: 'c28', code: 'TOMATO27', by: 'xiaoman', title: '明年春天还种番茄吗', created: -3, open: 140, fav: 12, plaza: true,
      content: `今年阳台的番茄一共结了十一个，被鸟吃掉四个。

明年还种吗？种的话，记得搭网。` },
    { id: 'c29', code: 'FIRSTJOB', by: 'ashu', title: '第一份工作的第一天', created: -1, open: 364, fav: 64, plaza: true,
      content: `工牌的带子还是硬的。打卡机响的那一声，我差点鞠躬。

一年后的你，应该已经学会偷偷摸鱼了吧。` },
  ];

  /* 演示账号默认收藏（值 = 相对 epoch 的收藏时间，天） */
  HT.SEED_FAVS = { c14: -2, c16: -5, c03: -20 };

  /* ---------- AI：灵感推荐（对应 GET /capsule-recommendations） ---------- */
  HT.RECOS = [
    [
      { title: '猜猜下一届奥运会的金牌榜', hint: '写下你的预测，到时候验证眼光', openInDays: 610 },
      { title: '这个冬天想学会的一件小事', hint: '给自己一个季节的期限', openInDays: 90 },
      { title: '五年后的我住在哪座城市', hint: '把答案藏起来，交给时间揭晓', openInDays: 1825 },
      { title: '下个月发工资那天的心愿', hint: '小小的奖励，也值得郑重其事', openInDays: 30 },
    ],
    [
      { title: '十年后还在联系的朋友', hint: '写下三个名字，十年后数一数', openInDays: 3650 },
      { title: '明年生日想收到的一句话', hint: '提前替未来的自己准备好', openInDays: 365 },
      { title: '这周最想记住的一个瞬间', hint: '趁它还没被日常冲淡', openInDays: 7 },
      { title: '等这本书读完再打开', hint: '写下此刻的期待，读完再对照', openInDays: 60 },
    ],
    [
      { title: '给第一次当父母的自己', hint: '那时候的你，一定手忙脚乱吧', openInDays: 1095 },
      { title: '下一次失眠时请读这封信', hint: '白天的你，想对夜里的你说', openInDays: 14 },
      { title: '今年没说出口的那句谢谢', hint: '一年后，也许就有勇气了', openInDays: 365 },
      { title: '存一份此刻的歌单', hint: '看十年后还会不会单曲循环', openInDays: 3650 },
    ],
  ];

  /* ---------- AI：代笔草稿（对应 POST /capsule-suggestion） ---------- */
  HT.DRAFTS = {
    '猜猜下一届奥运会的金牌榜': `写下这封信的时候，离洛杉矶还有一年多。我对着空白的金牌榜想了很久，最后还是决定凭直觉下注。

前三名的顺序大概不会有太大的意外，真正让我好奇的是那些冷门项目——会不会有一个此刻还没人听说过的名字，突然站上最高的领奖台？

我把预测折好放在这里：第一名写在信的背面，不许偷看。

等到圣火点燃的那个夏天，记得把这封信翻出来，对着电视一条一条核对。猜对了，就请自己吃一顿好的；猜错了，也请自己吃一顿好的。`,
    '这个冬天想学会的一件小事': `今年冬天来得比往年早一些，早上出门的时候，呼出的气已经看得见了。

我想趁这个冬天学会一件小事：好好煮一锅汤。不是外卖里的那种，是要守在灶台边，看着它从清水慢慢变成奶白色的那种。

听起来不算什么了不起的目标，但我已经太久没有为一件「没有用」的事情花过三个小时了。

等到春天，如果你已经能不看菜谱就把它做出来——请给现在这个站在调料货架前手足无措的人，盛上一碗。`,
    '五年后的我住在哪座城市': `此刻我坐在租来的房间里，窗外是一条走了无数遍的街。楼下水果店的老板已经认得我，但我始终不确定，这里算不算「我的城市」。

所以想把这个问题留给你：五年后，你住在哪里？

是留下来了，还是终于去了那座一直挂在嘴边的城市？早上醒来的时候，窗外是海、是山，还是另一条差不多的街？

不管答案是什么，我希望那是你自己选的。不是因为房租，不是因为「大家都这样」，而是因为某个傍晚，你走在路上，忽然觉得——就是这里了。`,
    '下个月发工资那天的心愿': `先坦白：这个月又是月光。

所以我想提前和下个月的自己做个约定。工资到账的那天，先别急着还账单，先去做一件只为自己高兴的小事。

可以是一束不打折的花，可以是那家一直嫌贵的馆子，也可以是把购物车里躺了三个月的那本书买下来。

预算不用多，但要郑重其事。因为我发现，那些「等以后有钱了再说」的心愿，往往不是败给了钱，而是败给了「再说」。

三十天后见。记得，要郑重其事。`,
  };

  HT.draftFor = function (title) {
    if (HT.DRAFTS[title]) return HT.DRAFTS[title];
    return `写下「${title}」这几个字的时候，窗外的天色正一点点暗下来。

我不知道你打开这封信的那天，会是晴天还是雨天，是匆匆扫一眼，还是坐下来慢慢读完。但我想把此刻的心情原样留给你：有一点期待，有一点不确定，还有一点点说不出口的认真。

关于「${title}」，现在的我还没有答案。也许到了那一天，答案早已不重要；也许它会成为你回头看时，最庆幸自己写下来的一件事。

无论如何，谢谢你还记得回来看看。那时候的你，过得好吗？`;
  };

  /* 根据标题里的时间线索估一个开启天数（模拟 LLM 的 openInDays） */
  HT.daysFor = function (title) {
    for (const batch of HT.RECOS) for (const r of batch) if (r.title === title) return r.openInDays;
    if (/十年|10\s*年/.test(title)) return 3650;
    if (/五年|5\s*年/.test(title)) return 1825;
    if (/三年|3\s*年/.test(title)) return 1095;
    if (/明年|一年|1\s*年|生日/.test(title)) return 365;
    if (/下个月|月底/.test(title)) return 30;
    if (/下周|这周/.test(title)) return 7;
    if (/明天/.test(title)) return 1;
    return 180;
  };

  /* ---------- 技术栈：模拟 GET /health 的 stack ---------- */
  const it = (role, name, version, icon) => ({ role, name, version, iconUrl: icon ? `assets/icons/${icon}.svg` : null });
  const PG = it('database', 'PostgreSQL', '16', 'postgresql');

  HT.FRONTEND_STACK = [
    it('framework', 'React', '19', 'react'),
    it('language', 'TypeScript', '5', 'typescript'),
    it('styling', 'Tailwind CSS', '4', 'tailwindcss'),
  ];

  HT.BACKENDS = [
    { key: 'spring-boot', name: 'Spring Boot', port: 29000, items: [it('language', 'Java', '21', 'java'), it('framework', 'Spring Boot', '3', 'springboot'), PG, it('orm', 'Hibernate', '6', 'hibernate')],
      summary: '约定优于配置的企业级底座：自动装配、内嵌容器、JPA 仓储，一条龙地把契约落到 JVM 上。' },
    { key: 'fastapi', name: 'FastAPI', port: 29010, ref: true, items: [it('language', 'Python', '3.12', 'python'), it('framework', 'FastAPI', '0.115', 'fastapi'), PG, it('orm', 'SQLAlchemy', '2.0', null)],
      summary: '参考实现。类型注解即契约，Pydantic 负责校验，SQLAlchemy 2.0 的会话边界让每一次收藏计数都落在同一个事务里。' },
    { key: 'gin', name: 'Gin', port: 29020, items: [it('language', 'Go', '1.23', 'go'), it('framework', 'Gin', '1.10', 'gin'), PG],
      summary: '单二进制、毫秒级启动。中间件链短而直白，Goroutine 让并发写起来几乎没有仪式感。' },
    { key: 'elysia', name: 'Elysia', port: 29030, items: [it('language', 'TypeScript', '5', 'typescript'), it('runtime', 'Bun', '1', 'bun'), it('framework', 'Elysia', '1', 'elysia'), PG],
      summary: '跑在 Bun 上的端到端类型安全：路由的入参与出参在编译期就对齐了契约。' },
    { key: 'nest', name: 'NestJS', port: 29040, items: [it('language', 'TypeScript', '5', 'typescript'), it('runtime', 'Node.js', '22', 'nodejs'), it('framework', 'NestJS', '10', 'nestjs'), PG],
      summary: '模块 / 控制器 / 服务三层分明，依赖注入贯穿始终——Angular 的秩序感搬到了服务端。' },
    { key: 'aspnet', name: 'ASP.NET Core', port: 29050, items: [it('language', 'C#', '12', 'csharp'), it('framework', 'ASP.NET Core', '8.0', 'aspnet'), it('runtime', '.NET', '8', 'dotnet'), it('orm', 'EF Core', '8.0', 'dotnet'), PG],
      summary: 'Kestrel 打底，LINQ 即查询；EF Core 的值转换器按方言接管了跨库的存储格式。' },
    { key: 'vapor', name: 'Vapor', port: 29060, items: [it('language', 'Swift', '6.2', 'swift'), it('framework', 'Vapor', '4', 'vapor'), it('runtime', 'SwiftNIO', '2', 'swift'), PG],
      summary: 'Swift Concurrency 写服务端：强类型把大量错误挡在编译期，async/await 读起来像同步代码。' },
    { key: 'axum', name: 'Axum', port: 29070, items: [it('language', 'Rust', '1.94', 'rust'), it('framework', 'Axum', '0.8', 'axum'), it('runtime', 'Tokio', '1', 'rust'), PG],
      summary: '类型驱动的提取器在编译期校验路由，Tower 中间件生态共享，没有 GC 也没有数据竞争。' },
    { key: 'drogon', name: 'Drogon', port: 29080, items: [it('language', 'C++', '20', 'cpp'), it('framework', 'Drogon', '1.9', 'drogon'), it('runtime', 'Trantor', '1', 'cpp'), PG],
      summary: '性能极限选手：协程简化异步，epoll / kqueue 直通内核，每一个字节的去向都在掌控之中。' },
    { key: 'ktor', name: 'Ktor', port: 29090, items: [it('language', 'Kotlin', '2', 'kotlin'), it('framework', 'Ktor', '2.3', 'ktor'), it('runtime', 'JVM', '21', 'java'), PG],
      summary: 'Kotlin DSL 声明路由，协程原生支持，异步代码写得像同步一样平铺直叙。' },
  ];

  HT.TECH_NOTE = {
    'React': '声明式 UI 库，组件化与单向数据流的事实标准',
    'TypeScript': '给 JavaScript 加上静态类型的工业级超集',
    'Tailwind CSS': '原子化 CSS，用设计令牌快速组合稳定界面',
    'Python': '优雅、动态的通用语言，类型注解让大项目也安心',
    'FastAPI': '基于 Starlette + Pydantic 的现代异步框架',
    'PostgreSQL': '功能丰富的开源关系型数据库',
    'SQLAlchemy': 'Python 生态里最严谨的关系映射库',
    'Java': '运行在 JVM 上的强类型语言，一次编写处处运行',
    'Spring Boot': 'Java 生态最主流的企业级框架，约定优于配置',
    'Hibernate': 'JPA 规范的事实参考实现',
    'Go': '简洁与并发是其核心的编译型语言',
    'Gin': 'Go 生态最流行的高性能 HTTP 框架',
    'Bun': '把运行时、打包器、测试器合而为一的 JS 运行时',
    'Elysia': '为 Bun 量身打造的类型安全框架',
    'Node.js': '基于 V8 的服务端 JavaScript 运行时',
    'NestJS': 'Angular 风格的 Node.js 企业级框架',
    'C#': '.NET 生态的核心，多范式静态语言',
    'ASP.NET Core': '微软跨平台高性能 Web 框架',
    '.NET': '跨平台的托管运行时与基础类库',
    'EF Core': '.NET 旗舰 ORM，LINQ 即查询',
    'Swift': 'Apple 设计的现代安全语言',
    'Vapor': 'Swift 原生 Web 框架，类型安全且性能出色',
    'SwiftNIO': 'Swift 的事件驱动非阻塞网络框架',
    'Rust': '没有 GC 的系统级语言，所有权模型保证内存安全',
    'Axum': '基于 Tokio + Tower 的异步 Web 框架',
    'Tokio': 'Rust 的异步运行时',
    'C++': '零开销抽象的系统级语言',
    'Drogon': 'C++ 异步 HTTP 框架，性能极限选手',
    'Trantor': 'Drogon 底层的非阻塞 I/O 网络库',
    'Kotlin': 'JetBrains 打造的现代 JVM 语言',
    'Ktor': 'JetBrains 出品的 Kotlin 异步框架',
    'JVM': 'Java 虚拟机：JIT 编译 + 分代 GC',
  };

  HT.ROLE_LABEL = { language: '语言', framework: '框架', database: '数据库', orm: 'ORM', runtime: '运行时', styling: '样式' };

})(window.HT = window.HT || {});
