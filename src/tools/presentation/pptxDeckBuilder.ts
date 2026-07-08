/**
 * Deterministic PPTX deck builder.
 *
 * A .pptx file is a ZIP of OOXML parts; this module writes the minimal set by
 * hand (presentation, one master/layout/theme, one slide + notes slide per
 * deck-plan entry) so no presentation library is needed. Each slide carries
 * the title, the short on-slide bullets, a dashed visual/screenshot
 * placeholder box, and the speaker notes in the PowerPoint notes pane.
 *
 * No LLM involvement and no design ambition: the structured deck plan is
 * rendered exactly as the skill produced it. Pure and total — never throws;
 * an empty deck plan yields a single friendly "no slides yet" slide.
 */
import type { DeckSlide, ScreenshotPlanItem } from '../../skills/demoPrepLoop/index.js';
import type { MarkdownDeckInput } from './types.js';
import { slideVisualLines } from './slideVisuals.js';
import { createZip, type ZipEntry } from './zip.js';

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL_NS = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"';
const REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** 16:9 slide canvas in EMUs (English Metric Units, 914400 per inch). */
const SLIDE_W = 12192000;
const SLIDE_H = 6858000;

export function buildPptxDeck(input: MarkdownDeckInput): Uint8Array {
  const slides: DeckSlide[] = input.deckPlan.length > 0 ? [...input.deckPlan] : [emptyDeckSlide()];
  const shotsById = new Map((input.screenshotPlan ?? []).map((shot) => [shot.id, shot]));
  const encoder = new TextEncoder();
  const xmlEntry = (name: string, xml: string): ZipEntry => ({
    name,
    data: encoder.encode(`${XML_HEADER}\n${xml}`),
  });

  const entries: ZipEntry[] = [
    xmlEntry('[Content_Types].xml', contentTypesXml(slides.length)),
    xmlEntry('_rels/.rels', packageRelsXml()),
    xmlEntry('ppt/presentation.xml', presentationXml(slides.length)),
    xmlEntry('ppt/_rels/presentation.xml.rels', presentationRelsXml(slides.length)),
    xmlEntry('ppt/theme/theme1.xml', themeXml()),
    xmlEntry('ppt/slideMasters/slideMaster1.xml', slideMasterXml()),
    xmlEntry('ppt/slideMasters/_rels/slideMaster1.xml.rels', slideMasterRelsXml()),
    xmlEntry('ppt/slideLayouts/slideLayout1.xml', slideLayoutXml()),
    xmlEntry('ppt/slideLayouts/_rels/slideLayout1.xml.rels', slideLayoutRelsXml()),
    xmlEntry('ppt/notesMasters/notesMaster1.xml', notesMasterXml()),
    xmlEntry('ppt/notesMasters/_rels/notesMaster1.xml.rels', notesMasterRelsXml()),
  ];

  slides.forEach((slide, index) => {
    const n = index + 1;
    entries.push(
      xmlEntry(`ppt/slides/slide${n}.xml`, slideXml({ slide, shotsById })),
      xmlEntry(`ppt/slides/_rels/slide${n}.xml.rels`, slideRelsXml(n)),
      xmlEntry(`ppt/notesSlides/notesSlide${n}.xml`, notesSlideXml(slide)),
      xmlEntry(`ppt/notesSlides/_rels/notesSlide${n}.xml.rels`, notesSlideRelsXml(n)),
    );
  });

  return createZip(entries);
}

/** The friendly stand-in rendered when the deck plan has no slides yet. */
function emptyDeckSlide(): DeckSlide {
  return {
    slideNumber: 1,
    title: 'No slides in the deck plan yet',
    purpose: 'Placeholder deck',
    visualType: 'summary',
    whatToShow: 'Generate the Demo Prep Loop deck plan first.',
    onSlideText: ['Generate the deck plan first'],
    speakerNotes: 'The Demo Prep Loop deck plan had no slides when this deck was exported.',
    narrationScript: '',
    transitionToNextSlide: '',
    estimatedTimeSeconds: 0,
    mustHave: false,
    status: 'draft',
  };
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function contentTypesXml(slideCount: number): string {
  const slideOverrides = Array.from({ length: slideCount }, (_, i) => {
    const n = i + 1;
    return (
      `<Override PartName="/ppt/slides/slide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>` +
      `<Override PartName="/ppt/notesSlides/notesSlide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`
    );
  }).join('');
  return (
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
    '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
    '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
    '<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/>' +
    '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
    slideOverrides +
    '</Types>'
  );
}

function packageRelsXml(): string {
  return (
    `<Relationships ${REL_NS}>` +
    `<Relationship Id="rId1" Type="${REL_TYPE}/officeDocument" Target="ppt/presentation.xml"/>` +
    '</Relationships>'
  );
}

function presentationXml(slideCount: number): string {
  const slideIds = Array.from(
    { length: slideCount },
    (_, i) => `<p:sldId id="${256 + i}" r:id="rId${3 + i}"/>`,
  ).join('');
  return (
    `<p:presentation ${NS}>` +
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
    '<p:notesMasterIdLst><p:notesMasterId r:id="rId2"/></p:notesMasterIdLst>' +
    `<p:sldIdLst>${slideIds}</p:sldIdLst>` +
    `<p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}"/>` +
    '<p:notesSz cx="6858000" cy="9144000"/>' +
    '</p:presentation>'
  );
}

function presentationRelsXml(slideCount: number): string {
  const slideRels = Array.from(
    { length: slideCount },
    (_, i) =>
      `<Relationship Id="rId${3 + i}" Type="${REL_TYPE}/slide" Target="slides/slide${i + 1}.xml"/>`,
  ).join('');
  return (
    `<Relationships ${REL_NS}>` +
    `<Relationship Id="rId1" Type="${REL_TYPE}/slideMaster" Target="slideMasters/slideMaster1.xml"/>` +
    `<Relationship Id="rId2" Type="${REL_TYPE}/notesMaster" Target="notesMasters/notesMaster1.xml"/>` +
    slideRels +
    '</Relationships>'
  );
}

/** The empty shape tree required at the top of every cSld. */
function emptySpTreeHeader(): string {
  return (
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>' +
    '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
  );
}

function clrMap(): string {
  return (
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" ' +
    'accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>'
  );
}

function slideMasterXml(): string {
  return (
    `<p:sldMaster ${NS}>` +
    '<p:cSld>' +
    '<p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg1"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>' +
    `<p:spTree>${emptySpTreeHeader()}</p:spTree>` +
    '</p:cSld>' +
    clrMap() +
    '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
    '<p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>' +
    '</p:sldMaster>'
  );
}

function slideMasterRelsXml(): string {
  return (
    `<Relationships ${REL_NS}>` +
    `<Relationship Id="rId1" Type="${REL_TYPE}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
    `<Relationship Id="rId2" Type="${REL_TYPE}/theme" Target="../theme/theme1.xml"/>` +
    '</Relationships>'
  );
}

function slideLayoutXml(): string {
  return (
    `<p:sldLayout ${NS} type="blank">` +
    `<p:cSld name="Blank"><p:spTree>${emptySpTreeHeader()}</p:spTree></p:cSld>` +
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>' +
    '</p:sldLayout>'
  );
}

function slideLayoutRelsXml(): string {
  return (
    `<Relationships ${REL_NS}>` +
    `<Relationship Id="rId1" Type="${REL_TYPE}/slideMaster" Target="../slideMasters/slideMaster1.xml"/>` +
    '</Relationships>'
  );
}

function notesMasterXml(): string {
  return (
    `<p:notesMaster ${NS}>` +
    `<p:cSld><p:spTree>${emptySpTreeHeader()}</p:spTree></p:cSld>` +
    clrMap() +
    '</p:notesMaster>'
  );
}

function notesMasterRelsXml(): string {
  // The notes master reuses the single deck theme rather than carrying its own.
  return (
    `<Relationships ${REL_NS}>` +
    `<Relationship Id="rId1" Type="${REL_TYPE}/theme" Target="../theme/theme1.xml"/>` +
    '</Relationships>'
  );
}

function themeXml(): string {
  const fill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
  const line = (w: number): string =>
    `<a:ln w="${w}"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>`;
  return (
    '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Deck Theme">' +
    '<a:themeElements>' +
    '<a:clrScheme name="Deck">' +
    '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>' +
    '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
    '<a:dk2><a:srgbClr val="1F2A44"/></a:dk2>' +
    '<a:lt2><a:srgbClr val="EEECE1"/></a:lt2>' +
    '<a:accent1><a:srgbClr val="4472C4"/></a:accent1>' +
    '<a:accent2><a:srgbClr val="ED7D31"/></a:accent2>' +
    '<a:accent3><a:srgbClr val="A5A5A5"/></a:accent3>' +
    '<a:accent4><a:srgbClr val="FFC000"/></a:accent4>' +
    '<a:accent5><a:srgbClr val="5B9BD5"/></a:accent5>' +
    '<a:accent6><a:srgbClr val="70AD47"/></a:accent6>' +
    '<a:hlink><a:srgbClr val="0563C1"/></a:hlink>' +
    '<a:folHlink><a:srgbClr val="954F72"/></a:folHlink>' +
    '</a:clrScheme>' +
    '<a:fontScheme name="Deck">' +
    '<a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
    '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>' +
    '</a:fontScheme>' +
    '<a:fmtScheme name="Deck">' +
    `<a:fillStyleLst>${fill}${fill}${fill}</a:fillStyleLst>` +
    `<a:lnStyleLst>${line(6350)}${line(12700)}${line(19050)}</a:lnStyleLst>` +
    '<a:effectStyleLst>' +
    '<a:effectStyle><a:effectLst/></a:effectStyle>' +
    '<a:effectStyle><a:effectLst/></a:effectStyle>' +
    '<a:effectStyle><a:effectLst/></a:effectStyle>' +
    '</a:effectStyleLst>' +
    `<a:bgFillStyleLst>${fill}${fill}${fill}</a:bgFillStyleLst>` +
    '</a:fmtScheme>' +
    '</a:themeElements>' +
    '</a:theme>'
  );
}

/** A plain text box shape with one paragraph per line. */
function textBox({
  id,
  name,
  x,
  y,
  cx,
  cy,
  paragraphs,
  dashedOutline = false,
}: {
  id: number;
  name: string;
  x: number;
  y: number;
  cx: number;
  cy: number;
  paragraphs: { text: string; sizeHundredthsPt: number; bold?: boolean; italic?: boolean; gray?: boolean; bullet?: boolean }[];
  dashedOutline?: boolean;
}): string {
  const outline = dashedOutline
    ? '<a:ln w="12700"><a:solidFill><a:srgbClr val="999999"/></a:solidFill><a:prstDash val="dash"/></a:ln>'
    : '';
  const body = paragraphs
    .map((para) => {
      const pPr = para.bullet
        ? '<a:pPr marL="285750" indent="-285750"><a:buFont typeface="Arial"/><a:buChar char="•"/></a:pPr>'
        : '';
      const color = para.gray === true ? '<a:solidFill><a:srgbClr val="595959"/></a:solidFill>' : '';
      const bold = para.bold === true ? ' b="1"' : '';
      const italic = para.italic === true ? ' i="1"' : '';
      return (
        `<a:p>${pPr}<a:r><a:rPr lang="en-US" sz="${para.sizeHundredthsPt}"${bold}${italic} dirty="0">${color}</a:rPr>` +
        `<a:t>${escapeXml(para.text)}</a:t></a:r></a:p>`
      );
    })
    .join('');
  return (
    '<p:sp>' +
    `<p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>${outline}</p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square"><a:normAutofit/></a:bodyPr><a:lstStyle/>${body}</p:txBody>` +
    '</p:sp>'
  );
}

function slideXml({
  slide,
  shotsById,
}: {
  slide: DeckSlide;
  shotsById: ReadonlyMap<string, ScreenshotPlanItem>;
}): string {
  const margin = 685800; // 0.75in
  const width = SLIDE_W - 2 * margin;

  const title = textBox({
    id: 2,
    name: 'Title 1',
    x: margin,
    y: 365760,
    cx: width,
    cy: 1097280,
    paragraphs: [
      { text: `Slide ${slide.slideNumber} — ${slide.title}`, sizeHundredthsPt: 3200, bold: true },
    ],
  });

  const bulletTexts = slide.onSlideText.length > 0 ? slide.onSlideText : ['(no on-slide text)'];
  const bullets = textBox({
    id: 3,
    name: 'On Slide 2',
    x: margin,
    y: 1737360,
    cx: width,
    cy: 2560320,
    paragraphs: bulletTexts.map((text) => ({ text, sizeHundredthsPt: 2000, bullet: true })),
  });

  const visual = textBox({
    id: 4,
    name: 'Visual Placeholder 3',
    x: margin,
    y: 4480560,
    cx: width,
    cy: 1920240,
    dashedOutline: true,
    paragraphs: slideVisualLines({ slide, shotsById }).map((text) => ({
      text,
      sizeHundredthsPt: 1400,
      italic: true,
      gray: true,
    })),
  });

  return (
    `<p:sld ${NS}>` +
    `<p:cSld><p:spTree>${emptySpTreeHeader()}${title}${bullets}${visual}</p:spTree></p:cSld>` +
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>' +
    '</p:sld>'
  );
}

function slideRelsXml(n: number): string {
  return (
    `<Relationships ${REL_NS}>` +
    `<Relationship Id="rId1" Type="${REL_TYPE}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
    `<Relationship Id="rId2" Type="${REL_TYPE}/notesSlide" Target="../notesSlides/notesSlide${n}.xml"/>` +
    '</Relationships>'
  );
}

function notesSlideXml(slide: DeckSlide): string {
  const noteLines = slide.speakerNotes.split('\n').filter((line) => line.trim() !== '');
  const paragraphs = (noteLines.length > 0 ? noteLines : ['(no speaker notes)'])
    .map((line) => `<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${escapeXml(line)}</a:t></a:r></a:p>`)
    .join('');
  return (
    `<p:notes ${NS}>` +
    '<p:cSld><p:spTree>' +
    emptySpTreeHeader() +
    '<p:sp>' +
    '<p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder 1"/>' +
    '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
    '<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>' +
    '<p:spPr/>' +
    `<p:txBody><a:bodyPr/><a:lstStyle/>${paragraphs}</p:txBody>` +
    '</p:sp>' +
    '</p:spTree></p:cSld>' +
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>' +
    '</p:notes>'
  );
}

function notesSlideRelsXml(n: number): string {
  return (
    `<Relationships ${REL_NS}>` +
    `<Relationship Id="rId1" Type="${REL_TYPE}/notesMaster" Target="../notesMasters/notesMaster1.xml"/>` +
    `<Relationship Id="rId2" Type="${REL_TYPE}/slide" Target="../slides/slide${n}.xml"/>` +
    '</Relationships>'
  );
}
