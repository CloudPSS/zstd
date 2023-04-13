import bindings from 'bindings';
/** node 模块 */
interface Binding {
    /** node 模块路径 */
    path: string;
    /** 压缩 */
    compress(data: Buffer, level: number): Buffer;
    /** 解压缩 */
    decompress(data: Buffer, maxSize: number): Buffer;
}

const binding = bindings('binding.node') as Binding;
export default binding;
