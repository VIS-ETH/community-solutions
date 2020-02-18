import {
  PDFPageProxy,
  PDFDocumentProxy,
  PDFPageViewport,
  PDFPromise,
} from "pdfjs-dist";
import * as pdfjs from "pdfjs-dist/webpack";

export default class SVGRenderer {
  document: PDFDocumentProxy;
  page?: PDFPageProxy;
  pageMap: Map<number, PDFPromise<PDFPageProxy>>;
  // tslint:disable-next-line: no-any
  operatorListMap: Map<number, PDFPromise<any[]>>;
  // tslint:disable-next-line: no-any
  gfxMap: Map<number, any>;
  svgMap: Map<number, SVGElement>;
  constructor(document: PDFDocumentProxy) {
    this.document = document;
    this.pageMap = new Map();
    this.operatorListMap = new Map();
    this.gfxMap = new Map();
    this.svgMap = new Map();
  }
  async getPage(pageNumber: number): Promise<PDFPageProxy> {
    const cachedPage = this.pageMap.get(pageNumber);
    if (cachedPage !== undefined) return cachedPage;

    const loadedPage = this.document.getPage(pageNumber);
    this.pageMap.set(pageNumber, loadedPage);
    return loadedPage;
  }
  // tslint:disable-next-line: no-any
  async getOperatorList(pageNumber: number): Promise<any[]> {
    const cachedOperatorList = this.operatorListMap.get(pageNumber);
    if (cachedOperatorList !== undefined) return cachedOperatorList;
    const page = await this.getPage(pageNumber);
    // tslint:disable-next-line: no-any
    const operatorList = (page as any).getOperatorList();
    this.operatorListMap.set(pageNumber, operatorList);
    return operatorList;
  }
  // tslint:disable-next-line: no-any
  async getGfx(pageNumber: number): Promise<any> {
    const cachedGfx = this.gfxMap.get(pageNumber);
    if (cachedGfx !== undefined) return cachedGfx;

    const page = await this.getPage(pageNumber);
    // tslint:disable-next-line: no-any
    const objs = (page as any).commonObjs._objs;
    for (const name in objs) {
      console.log(name);
      console.log(JSON.stringify([...objs[name].data.data]));
    }
    // tslint:disable-next-line: no-any
    const gfx = new (pdfjs as any).SVGGraphics(
      // tslint:disable-next-line: no-any
      (page as any).commonObjs,
      // tslint:disable-next-line: no-any
      (page as any).objs,
    );
    this.gfxMap.set(pageNumber, gfx);
    return gfx;
  }
  async renderSvg(
    pageNumber: number,
    viewport: PDFPageViewport,
  ): Promise<SVGElement> {
    const cachedSvg = this.svgMap.get(pageNumber);
    if (cachedSvg !== undefined) return cachedSvg.cloneNode(true) as SVGElement;
    const operatorList = await this.getOperatorList(pageNumber);
    const gfx = await this.getGfx(pageNumber);
    const element = await gfx.getSVG(operatorList, viewport);
    this.svgMap.set(pageNumber, element);
    return element;
  }
}
