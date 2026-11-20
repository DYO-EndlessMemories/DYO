const encoder = new TextEncoder();
const decoder = new TextDecoder();
const exifId = encoder.encode("Exif\0\0");
const xmpId = encoder.encode("http://ns.adobe.com/xap/1.0/\0");
const photoshopId = encoder.encode("Photoshop 3.0\0");
const view = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const matches = (bytes, prefix) => prefix.every((byte, index) => bytes[index] === byte);

function dateFields(date) {
  const pad = n => String(n).padStart(2, "0");
  const day = [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())];
  const clock = [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())];
  const offset = -date.getTimezoneOffset();
  const zone = (offset < 0 ? "-" : "+") + pad(Math.floor(Math.abs(offset) / 60)) + ":" + pad(Math.abs(offset) % 60);
  return {
    exif: day.join(":") + " " + clock.join(":"),
    iso: day.join("-") + "T" + clock.join(":") + zone,
    day: day.join(""),
    time: clock.join("") + zone.replace(":", ""),
    zone,
    utc: date.toUTCString()
  };
}

function readDirectory(bytes, offset, little) {
  if (!offset) return { entries: [], next: 0 };
  const data = view(bytes);
  if (offset < 8 || offset + 2 > bytes.length) throw new Error("Invalid EXIF directory");
  const count = data.getUint16(offset, little);
  const end = offset + 2 + count * 12;
  if (end + 4 > bytes.length) throw new Error("Invalid EXIF directory size");
  const entries = Array.from({ length: count }, (_, index) => {
    const start = offset + 2 + index * 12;
    return bytes.slice(start, start + 12);
  });
  return { entries, next: data.getUint32(end, little) };
}

function exifWithDate(original, fields) {
  const bytes = original || Uint8Array.of(73, 73, 42, 0, 0, 0, 0, 0);
  const little = bytes[0] === 73 && bytes[1] === 73;
  const data = view(bytes);
  if ((!little && !(bytes[0] === 77 && bytes[1] === 77)) || data.getUint16(2, little) !== 42) {
    throw new Error("Invalid TIFF EXIF header");
  }
  const ifd = readDirectory(bytes, data.getUint32(4, little), little);
  const getTag = entry => view(entry).getUint16(0, little);
  const pointer = ifd.entries.find(entry => getTag(entry) === 0x8769);
  const exif = readDirectory(bytes, pointer ? view(pointer).getUint32(8, little) : 0, little);
  const start = bytes.length + bytes.length % 2;
  const date = encoder.encode(fields.exif + "\0");
  const zone = encoder.encode(fields.zone + "\0");
  const dateOffset = start;
  const zoneOffset = dateOffset + date.length;
  const exifOffset = zoneOffset + zone.length + zone.length % 2;

  function entry(tag, type, count, value) {
    const bytes = new Uint8Array(12);
    const field = view(bytes);
    field.setUint16(0, tag, little);
    field.setUint16(2, type, little);
    field.setUint32(4, count, little);
    field.setUint32(8, value, little);
    return bytes;
  }

  const dateEntry = tag => entry(tag, 2, date.length, dateOffset);
  const offsetEntry = tag => entry(tag, 2, zone.length, zoneOffset);
  const dateTags = new Set([0x9003, 0x9004, 0x9010, 0x9011, 0x9012, 0x9290, 0x9291, 0x9292]);
  const exifEntries = exif.entries.filter(field => !dateTags.has(getTag(field)));
  exifEntries.push(dateEntry(0x9003), dateEntry(0x9004), offsetEntry(0x9010), offsetEntry(0x9011), offsetEntry(0x9012));
  const ifdOffset = exifOffset + 6 + exifEntries.length * 12;
  const ifdEntries = ifd.entries.filter(field => ![0x0132, 0x8769].includes(getTag(field)));
  ifdEntries.push(dateEntry(0x0132), entry(0x8769, 4, 1, exifOffset));

  const result = new Uint8Array(ifdOffset + 6 + ifdEntries.length * 12);
  result.set(bytes);
  result.set(date, dateOffset);
  result.set(zone, zoneOffset);
  const output = view(result);
  output.setUint32(4, ifdOffset, little);
  function putDirectory(offset, entries, next) {
    entries.sort((a, b) => getTag(a) - getTag(b));
    output.setUint16(offset, entries.length, little);
    for (const [index, field] of entries.entries()) result.set(field, offset + 2 + index * 12);
    output.setUint32(offset + 2 + entries.length * 12, next, little);
  }
  putDirectory(exifOffset, exifEntries, exif.next);
  putDirectory(ifdOffset, ifdEntries, ifd.next);
  return result;
}

function refreshXmp(source, fields) {
  const names = "(?:xmp:(?:CreateDate|ModifyDate|MetadataDate)|photoshop:DateCreated|exif:(?:DateTimeOriginal|DateTimeDigitized)|tiff:DateTime)";
  return source
    .replace(new RegExp("(" + names + ")=([\"'])(.*?)\\2", "g"), (_, name, quote) => name + "=" + quote + fields.iso + quote)
    .replace(new RegExp("(<" + names + ">)[^<]*(</" + names + ">)", "g"), "$1" + fields.iso + "$2");
}

function refreshIptc(source, fields) {
  const bytes = source.slice();
  const data = view(bytes);
  const irb = encoder.encode("8BIM");
  for (let start = photoshopId.length; start + 12 <= bytes.length && matches(bytes.subarray(start), irb);) {
    const nameLength = 1 + bytes[start + 6];
    const lengthField = start + 6 + nameLength + nameLength % 2;
    if (lengthField + 4 > bytes.length) break;
    const length = data.getUint32(lengthField);
    const end = lengthField + 4 + length;
    if (end > bytes.length) break;
    if (data.getUint16(start + 4) === 0x0404) {
      for (let p = lengthField + 4; p + 5 <= end && bytes[p] === 0x1c;) {
        const size = data.getUint16(p + 3);
        if (p + 5 + size > end) break;
        const tag = bytes[p + 2];
        if (bytes[p + 1] === 2) {
          const stamp = tag === 55 || tag === 62 ? fields.day : tag === 60 || tag === 63 ? fields.time : "";
          if (stamp.length === size) bytes.set(encoder.encode(stamp), p + 5);
        }
        p += 5 + size;
      }
    }
    start = end + length % 2;
  }
  return bytes;
}

function jpegSegment(marker, ...parts) {
  const size = 2 + parts.reduce((sum, part) => sum + part.length, 0);
  if (size > 0xffff) throw new Error("JPEG metadata segment is too large");
  return [Uint8Array.of(0xff, marker, size >>> 8, size & 255), ...parts];
}

async function prepareJpeg(file) {
  const changes = [];
  let exifFound = false;
  let start = 2;
  let insertAt = 2;
  while (start + 4 < file.size) {
    const header = new Uint8Array(await file.slice(start, start + 4).arrayBuffer());
    if (header[0] !== 0xff) throw new Error("Invalid JPEG segment");
    const marker = header[1];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0xff) { start++; continue; }
    const end = start + 2 + view(header).getUint16(2);
    if (end < start + 4 || end > file.size) throw new Error("Invalid JPEG segment length");
    if (marker === 0xe0 && start === 2) insertAt = end;
    if (marker === 0xe1 || marker === 0xed) {
      const contents = new Uint8Array(await file.slice(start + 4, end).arrayBuffer());
      if (marker === 0xe1 && matches(contents, exifId)) {
        const tiff = contents.subarray(exifId.length);
        changes.push({ start, end, parts: fields => jpegSegment(marker, exifId, exifWithDate(tiff, fields)) });
        exifFound = true;
      } else if (marker === 0xe1 && matches(contents, xmpId)) {
        const source = decoder.decode(contents.subarray(xmpId.length));
        changes.push({ start, end, parts: fields => jpegSegment(marker, xmpId, encoder.encode(refreshXmp(source, fields))) });
      } else if (marker === 0xed && matches(contents, photoshopId)) {
        changes.push({ start, end, parts: fields => jpegSegment(marker, refreshIptc(contents, fields)) });
      }
    }
    start = end;
  }
  if (!exifFound) changes.unshift({
    start: insertAt, end: insertAt, parts: fields => jpegSegment(0xe1, exifId, exifWithDate(null, fields))
  });
  return changes;
}

function pngChunk(type, bytes) {
  const data = new Uint8Array(bytes.length + 12);
  const header = view(data);
  header.setUint32(0, bytes.length);
  data.set(encoder.encode(type), 4);
  data.set(bytes, 8);
  let crc = 0xffffffff;
  for (const byte of data.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  header.setUint32(data.length - 4, crc ^ 0xffffffff);
  return data;
}

async function preparePng(file) {
  const changes = [];
  let existingExif = null;
  // Insert after IHDR, before the compressed image data.
  const insertAt = 33;
  for (let start = 8; start + 12 <= file.size;) {
    const header = new Uint8Array(await file.slice(start, start + 8).arrayBuffer());
    const size = view(header).getUint32(0);
    const type = decoder.decode(header.subarray(4));
    const end = start + size + 12;
    if (end > file.size) throw new Error("Invalid PNG chunk length");
    if (type === "eXIf") {
      existingExif = new Uint8Array(await file.slice(start + 8, end - 4).arrayBuffer());
      changes.push({ start, end, parts: () => [] });
    }
    if (["tEXt", "iTXt", "zTXt"].includes(type)) {
      const keyword = new Uint8Array(await file.slice(start + 8, Math.min(end - 4, start + 88)).arrayBuffer());
      if (decoder.decode(keyword.subarray(0, keyword.indexOf(0))) === "Creation Time") {
        changes.push({ start, end, parts: () => [] });
      }
    }
    if (type === "IEND") break;
    start = end;
  }
  changes.unshift({ start: insertAt, end: insertAt, parts: fields => [
    pngChunk("eXIf", exifWithDate(existingExif, fields)),
    pngChunk("tEXt", encoder.encode("Creation Time\0" + fields.utc))
  ] });
  return changes;
}


function webpChunk(type, bytes) {
  const header = new Uint8Array(8);
  header.set(encoder.encode(type));
  view(header).setUint32(4, bytes.length, true);
  return [header, bytes, new Uint8Array(bytes.length % 2)];
}

function extendedWebpHeader(type, bytes) {
  const data = view(bytes);
  const payload = new Uint8Array(10);
  let width;
  let height;
  if (type === "VP8 " && matches(bytes.subarray(3), [157, 1, 42])) {
    width = (data.getUint16(6, true) & 0x3fff) - 1;
    height = (data.getUint16(8, true) & 0x3fff) - 1;
  } else if (type === "VP8L" && bytes[0] === 47) {
    const bits = data.getUint32(1, true);
    width = bits & 0x3fff;
    height = (bits >>> 14) & 0x3fff;
    if (bits & 0x10000000) payload[0] = 0x10;
  } else {
    throw new Error("Invalid WebP dimensions");
  }
  view(payload).setUint32(4, width | (height << 24), true);
  view(payload).setUint16(8, height >>> 8, true);
  return payload;
}

async function prepareWebp(file) {
  const changes = [];
  let extended = null;
  let dimensionHeader;
  let existingExif = null;
  let exifAt = file.size;
  for (let start = 12; start + 8 <= file.size;) {
    const header = new Uint8Array(await file.slice(start, start + 8).arrayBuffer());
    const type = decoder.decode(header.subarray(0, 4));
    const size = view(header).getUint32(4, true);
    const end = start + 8 + size + size % 2;
    if (end > file.size) throw new Error("Invalid WebP chunk length");
    if (type === "VP8X") {
      const data = new Uint8Array(await file.slice(start + 8, end).arrayBuffer());
      data[0] |= 0x08;
      extended = { start, end, parts: () => webpChunk(type, data) };
    } else if ((type === "VP8 " || type === "VP8L") && !extended && !dimensionHeader) {
      const bytes = new Uint8Array(await file.slice(start + 8, Math.min(start + 18, end)).arrayBuffer());
      dimensionHeader = extendedWebpHeader(type, bytes);
    } else if (type === "EXIF") {
      const bytes = new Uint8Array(await file.slice(start + 8, start + 8 + size).arrayBuffer());
      existingExif = matches(bytes, exifId) ? bytes.subarray(exifId.length) : bytes;
      changes.push({ start, end, parts: () => [] });
    } else if (type === "XMP ") {
      exifAt = start;
      const source = await file.slice(start + 8, start + 8 + size).text();
      changes.push({ start, end, parts: fields => webpChunk(type, encoder.encode(refreshXmp(source, fields))) });
    }
    start = end;
  }
  if (extended) changes.unshift(extended);
  else {
    if (!dimensionHeader) throw new Error("Missing WebP dimensions");
    dimensionHeader[0] |= 0x08;
    changes.unshift({ start: 12, end: 12, parts: () => webpChunk("VP8X", dimensionHeader) });
  }
  changes.push({ start: exifAt, end: exifAt, parts: fields => webpChunk("EXIF", exifWithDate(existingExif, fields)) });
  changes.sort((a, b) => a.start - b.start || a.end - b.end);
  return changes;
}

export async function preparePhotoDate(file) {
  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const webp = decoder.decode(signature.subarray(0, 4)) === "RIFF" && decoder.decode(signature.subarray(8)) === "WEBP";
  const changes = matches(signature, [0xff, 0xd8]) ? await prepareJpeg(file)
    : matches(signature, [137, 80, 78, 71, 13, 10, 26, 10]) ? await preparePng(file)
    : webp ? await prepareWebp(file) : null;
  if (!changes) throw new Error("Unsupported photo file format");
  return date => {
    const fields = dateFields(date);
    const parts = [];
    let offset = webp ? 12 : 0;
    for (const change of changes) {
      parts.push(file.slice(offset, change.start), ...change.parts(fields));
      offset = change.end;
    }
    parts.push(file.slice(offset));
    if (webp) {
      const header = signature.slice();
      const payloadSize = parts.reduce((size, part) => size + (part.size ?? part.byteLength), 0);
      view(header).setUint32(4, payloadSize + 4, true);
      parts.unshift(header);
    }
    return new File(parts, file.name, { type: file.type, lastModified: date.getTime() });
  };
}
