declare module 'adm-zip' {
  class AdmZip {
    constructor(fileNameOrRawData?: string | Buffer);
    getEntries(): AdmZip.IZipEntry[];
    extractAllTo(targetPath: string, overwrite?: boolean): void;
    toBuffer(): Buffer;
  }

  namespace AdmZip {
    interface IZipEntry {
      entryName: string;
      isDirectory: boolean;
      getData(): Buffer;
    }
  }

  export = AdmZip;
}
