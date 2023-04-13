/** node 模块 */
interface Binding {
  /** 压缩 */
  compress(data: Buffer, level: number): Buffer;
  /** 解压缩 */
  decompress(data: Buffer, maxSize: number): Buffer;
}

const binding: Binding;
export = binding;
