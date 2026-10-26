/** Full-file unified diff, including correct EOF markers for files without a final newline. */
export function createPatch(path,before,after){
 if(before===after)return '';
 const lines=text=>text===''?[]:text.replace(/\n$/,'').split('\n');
 const old=lines(before),next=lines(after);
 const block=(list,prefix,text)=>list.map(l=>prefix+l+'\n').join('')+(list.length&&!text.endsWith('\n')?'\\ No newline at end of file\n':'');
 return `--- a/${path}\n+++ b/${path}\n@@ -${old.length?1:0},${old.length} +${next.length?1:0},${next.length} @@\n`+block(old,'-',before)+block(next,'+',after);
}
