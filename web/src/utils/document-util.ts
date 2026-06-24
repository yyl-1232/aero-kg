import { Images, SupportedPreviewDocumentTypes } from '@/constants/common';
import { IReferenceChunk } from '@/interfaces/database/chat';
import { IChunk } from '@/interfaces/database/knowledge';
import { UploadFile } from 'antd';
import { get } from 'lodash';
import { v4 as uuid } from 'uuid';

export const buildChunkHighlights = (
  selectedChunk: IChunk | IReferenceChunk,
  size: { width: number; height: number },
) => {
  return Array.isArray(selectedChunk?.positions) &&
    selectedChunk.positions.every((x) => Array.isArray(x))
    ? selectedChunk?.positions?.map((x) => {
        const boundingRect = {
          width: size.width,
          height: size.height,
          x1: x[1],
          x2: x[2],
          y1: x[3],
          y2: x[4],
        };
        return {
          id: uuid(),
          comment: {
            text: '',
            emoji: '',
          },
          content: {
            text:
              get(selectedChunk, 'content_with_weight') ||
              get(selectedChunk, 'content', ''),
          },
          position: {
            boundingRect: boundingRect,
            rects: [boundingRect],
            pageNumber: x[0],
          },
        };
      })
    : [];
};

export const isFileUploadDone = (file: UploadFile) => file.status === 'done';

export const getExtension = (name: string) =>
  name?.slice(name.lastIndexOf('.') + 1).toLowerCase() ?? '';

export const isPdf = (name: string) => {
  return getExtension(name) === 'pdf';
};

export const getUnSupportedFilesCount = (message: string) => {
  return message.split('\n').length;
};

export const isSupportedPreviewDocumentType = (fileExtension: string) => {
  return SupportedPreviewDocumentTypes.includes(fileExtension);
};

export const isImage = (image: string) => {
  return [...Images, 'svg'].some((x) => x === image);
};

// Windows 资源管理器风格的排序函数
// 排序优先级：数字(0-9) → 字母(a-z) → 中文/拼音(a-z) → 特殊符号
// 同组内使用 localeCompare（支持中文拼音、自然数字排序）
function getFirstCharType(str: string): number {
  if (!str) return 3;
  const code = str.codePointAt(0) || 0;
  // 数字 0-9
  if (code >= 0x30 && code <= 0x39) return 0;
  // 字母 a-z, A-Z
  if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a))
    return 1;
  // 中文 CJK 字符
  if (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0x20000 && code <= 0x2a6df) ||
    (code >= 0x2a700 && code <= 0x2b73f) ||
    (code >= 0x2b740 && code <= 0x2b81f) ||
    (code >= 0x2b820 && code <= 0x2ceaf)
  ) {
    return 2;
  }
  // 特殊符号
  return 3;
}

export function windowsExplorerSort(
  rowA: any,
  rowB: any,
  columnId: string,
): number {
  const aStr: string = String(rowA.getValue(columnId) ?? '').toLowerCase();
  const bStr: string = String(rowB.getValue(columnId) ?? '').toLowerCase();

  // 第一步：按首字符类型分组排序
  const aType = getFirstCharType(aStr);
  const bType = getFirstCharType(bStr);
  if (aType !== bType) {
    return aType - bType;
  }

  // 第二步：同组内使用 localeCompare 自然排序
  // numeric: true → 数字按数值排序
  // sensitivity: 'base' → 不区分大小写和声调
  return aStr.localeCompare(bStr, 'zh-CN', {
    numeric: true,
    sensitivity: 'base',
    caseFirst: 'lower',
  });
}
