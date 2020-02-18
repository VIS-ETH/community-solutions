import { PDFPageProxy, PDFDocumentProxy, PDFPageViewport } from "pdfjs-dist";
import * as pdfjs from "pdfjs-dist/webpack";

export default class SVGRenderer {
    document: PDFDocumentProxy;
    page?: PDFPageProxy;
    pageMap: Map<number, PDFPageProxy>;
    // tslint:disable-next-line: no-any
    operatorListMap: Map<number, any[]>;
    // tslint:disable-next-line: no-any
    gfxMap: Map<number, any>;
    constructor(document: PDFDocumentProxy) {
        this.document = document;
        this.pageMap = new Map();
        this.operatorListMap = new Map();
        this.gfxMap = new Map();
    }
    async getPage(pageNumber: number): Promise<PDFPageProxy> {
        const cachedPage = this.pageMap.get(pageNumber);
        if (cachedPage !== undefined) return cachedPage;

        const loadedPage = await this.document.getPage(pageNumber);
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
        const gfx = new (pdfjs as any).SVGGraphics((page as any).commonObjs, (page as any).objs);
        this.gfxMap.set(pageNumber, gfx);
        return gfx;
    }
    async renderSvg(pageNumber: number, viewport: PDFPageViewport): Promise<SVGElement> {
        const operatorList = await this.getOperatorList(pageNumber);
        const gfx = await this.getGfx(pageNumber);
        return await gfx.getSVG(operatorList, viewport);
    }
}