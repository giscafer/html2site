#! /usr/bin/env node

import fs from 'fs';
import path from 'path';
import sh from 'shelljs';

import groupByPath from './lib/group-by-path';
import sortByPreferences from './lib/sort-by-preferences';
import mdUrl from './lib/markdown-url-to-html';
import md2html from './lib/markdown-to-html';
import renderNav from './lib/render-nav';
import generateIndexInfo from './lib/generate-index-info';
import page from './lib/render-page';
import mdR from './lib/markdown-regex';
import { FileTree, StringFile } from './lib/types';
import htmlUrl from './lib/html-url-to-html';

const [docsFolder, ...argsRest] = process.argv.slice(2);

// Default parameters
const defaultFolder = 'docs';
const folder = path.resolve(docsFolder || defaultFolder);
const output = path.resolve(folder, '..', `_${path.basename(folder)}`);
const templateFilename = 'template.html';
const contentsFilename = 'contents.json';
const preferences = ['index.md', 'README.md'];

// Guards
// Bail out if more than 1 args
if (argsRest && argsRest.length > 0) {
  console.error('Too may arguments');
  usage(true);
}

// Bail out if the folder doesn't exist
if (!fs.existsSync(folder)) {
  console.error(`Folder ${folder} not found.`);
  usage(true);
}
console.log('删除上次生成文件');
// Define template html, user's first, otherwise default
let template = path.join(folder, templateFilename);
if (!fs.existsSync(template)) {
  template = path.join(__dirname, defaultFolder, templateFilename);
}
const tpl = fs.readFileSync(template, 'utf8');
// Prepare output folder (create, clean, copy sources)
fs.mkdirSync(output, { recursive: true });
sh.rm('-rf', path.join(output, '*'));
// sh.cp('-R', path.join(folder, '**/*.html'), output); // 生成无目录
console.log('复制文件……');
sh.cp('-R', path.join(folder, '*'), output);
sh.rm('-rf', path.join(output, '**/*.mp3'));
sh.rm('-rf', path.join(output, '**/*.m4a'));
sh.rm('-rf', path.join(output, '**/*.pdf'));

// Start processing. Outline:
//
// 1. Get all files
// 2. Sort them
// 3. Group them hierachically
// 4. Parse files and generate output html files

sh.cd(output);
console.log('生成静态网页……');
const all = sh.find('*');

const mds = all
  .filter((file) => file.match(mdR))
  .sort(sortByPreferences.bind(null, preferences))
  .map((file) => {
    const content = sh.cat(file).toString(); // The result is a weird not-string
    let mdurl = mdUrl(file);
    // console.log(mdurl);
    const idx = mdurl.lastIndexOf('/');
    const filename = mdurl.substring(idx);
    // console.log(filename);
    return {
      filename,
      path: htmlUrl(file),
      url: htmlUrl(file),
      content,
      html: `<iframe src="./readme.html" style="height:99vh;width:85vw;border:none" class="article-iframe"></iframe>`,
      // html: md2html(content)
    };
  });

const groupedMds: FileTree<StringFile> = mds.reduce(
  (grouped: FileTree<StringFile>, value) => groupByPath(grouped, value.path),
  []
);

/* mds.forEach(({ path, url, html }) => {
  // console.log('url=', url);
  const navHtml = renderNav(generateIndexInfo(path, groupedMds));
  const pageHtml = page(tpl, navHtml, html);
  fs.writeFileSync(url, pageHtml);
}); */
console.log('将文件写到目录=', output);

mds.forEach(({ filename, path, url, html }) => {
  if (filename === 'template.html') {
    const navHtml = `
    <a href="#menu" id="menuLink" class="menu-link">
      <span></span>
    </a>
    <div id="menu">${renderNav(generateIndexInfo(path, groupedMds))}</div>`;
    const pageHtml = page(tpl, navHtml, html);
    fs.writeFileSync(url, pageHtml);
  }
});

// 默认首页
const content = sh.cat(output + '/index.md').toString();
// console.log(content);
const pageHtml = page(tpl, '', md2html(content));
fs.writeFileSync(output + '/readme.html', pageHtml);

const contentsJSON = {
  paths: groupedMds,
  contents: mds.map((md, i) => ({ ...md, id: i })),
};
fs.writeFileSync(contentsFilename, JSON.stringify(contentsJSON, null, 2));

sh.cp('-r', './template.html', 'index.html');
sh.rm('-rf', './template.html');
// sh.rm("-r", "**/*.md");

function usage(error: boolean) {
  console.log(
    `
Usage:

  markdown-folder-to-html [input-folder]

    input-folder [optional] defaults to \`docs\`
  `
  );
  process.exit(error ? 1 : 0);
}
