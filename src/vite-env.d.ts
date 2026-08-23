/// <reference types="vite/client" />

interface SerialPort {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
}

interface Serial {
  requestPort(): Promise<SerialPort>;
  addEventListener(type: "disconnect", listener: (event: Event) => void): void;
  removeEventListener(type: "disconnect", listener: (event: Event) => void): void;
}

interface Navigator { serial?: Serial }
