const q=new URLSearchParams(location.search);
document.getElementById('about-label').textContent=q.get('label')??'';
document.getElementById('about-build').textContent=q.get('id')?'Build '+q.get('id'):'';
document.getElementById('about-close').addEventListener('click',()=>window.close());
addEventListener('keydown',e=>{if(e.key==='Escape'||e.key==='Enter')window.close();});
