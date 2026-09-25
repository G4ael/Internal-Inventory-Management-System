// Junta o build da demonstração num único arquivo HTML (CSS, JS e imagem embutidos),
// pronto para ser publicado como página. Uso: npm run build:demo
import { readFileSync, writeFileSync } from 'node:fs';

const pasta = 'dist-demo';
const html = readFileSync(`${pasta}/demo.html`, 'utf8');
const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="\/([^"]+\.css)"[^>]*>/g)].map(m => readFileSync(`${pasta}/${m[1]}`, 'utf8')).join('\n');
const js = [...html.matchAll(/<script type="module"[^>]*src="\/([^"]+\.js)"[^>]*><\/script>/g)].map(m => readFileSync(`${pasta}/${m[1]}`, 'utf8')).join('\n');
const imagem = 'data:image/webp;base64,' + readFileSync('public/imagens/aquecedores-recorte.webp').toString('base64');
const jsFinal = js.replaceAll('/imagens/aquecedores-recorte.webp', imagem).replace(/<\/script/gi, '<\\/script');

const saida = `<title>Servigás Gestão</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;600&family=Onest:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${css}</style>
<div id="root"></div>
<script type="module">${jsFinal}</script>
`;
writeFileSync(`${pasta}/servigas-demo.html`, saida);
console.log(`${pasta}/servigas-demo.html — ${(saida.length / 1024).toFixed(0)} KB`);
