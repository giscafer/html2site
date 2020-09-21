import mdR from './markdown-regex';

export default function htmlUrl(file: string) {
  return file.replace(mdR, '.html'); // 区分生成的文件名
}
