import * as hb from 'harfbuzzjs';
import fs from 'fs';
const fontData = fs.readFileSync('public/fonts/NotoSansArabic.ttf');
const mk = () => new hb.Font(new hb.Face(new hb.Blob(new Uint8Array(fontData))));

// A: prototype way
let f = mk();
let b = new hb.Buffer(); b.addText('BACKSTAGE'); b.guessSegmentProperties(); hb.shape(f, b);
console.log('guess:', JSON.stringify(b.getGlyphPositions().map(p=>p.xAdvance)));

// B: explicit way
f = mk();
b = new hb.Buffer(); b.addText('BACKSTAGE'); b.setDirection(hb.Direction.LTR); b.setScript('Latn'); b.setLanguage('ar'); hb.shape(f, b);
console.log('explicit:', JSON.stringify(b.getGlyphPositions().map(p=>p.xAdvance)));

// C: explicit without language
f = mk();
b = new hb.Buffer(); b.addText('BACKSTAGE'); b.setDirection(hb.Direction.LTR); b.setScript('Latn'); hb.shape(f, b);
console.log('no-lang:', JSON.stringify(b.getGlyphPositions().map(p=>p.xAdvance)));
