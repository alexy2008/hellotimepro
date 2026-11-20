// angular.json 里给 .svg 配了 text 加载器：import 一个 svg 得到它的源码字符串
declare module "*.svg" {
  const source: string;
  export default source;
}
