const limit32 = 0xffffffff;
const utf8Flag = 0x0800;
const crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
  let crc = byte;
  for (let bit = 0; bit < 8; bit++) {
    crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return crc;
});

async function checksum(file, signal) {
  const reader = file.stream().getReader();
  let crc = 0xffffffff;
  try {
    while (true) {
      if (signal.aborted) throw signal.reason;
      const { done, value } = await reader.read();
      if (done) return (crc ^ 0xffffffff) >>> 0;
      for (const byte of value) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
      }
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

function uniqueName(name, usedNames) {
  const safeName = name.replace(/[/\\:\u0000-\u001f]/g, "_").trim() || "imagine";
  const extensionIndex = safeName.lastIndexOf(".");
  const stem = extensionIndex > 0 ? safeName.slice(0, extensionIndex) : safeName;
  const extension = extensionIndex > 0 ? safeName.slice(extensionIndex) : "";
  let candidate = safeName;
  for (let number = 2; usedNames.has(candidate.toLowerCase()); number++) {
    candidate = stem + " (" + number + ")" + extension;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

export async function makePhotoZip(entries, load, signal, onProgress) {
  const encoder = new TextEncoder();
  const usedNames = new Set();
  const parts = [];
  const directory = [];
  const now = new Date();
  const dosTime = now.getHours() << 11 | now.getMinutes() << 5 | now.getSeconds() >> 1;
  const dosDate = (now.getFullYear() - 1980) << 9 | (now.getMonth() + 1) << 5 | now.getDate();
  let offset = 0;
  let directorySize = 0;

  if (entries.length >= 0xffff) throw new RangeError("ZIP has too many entries");
  for (const [index, entry] of entries.entries()) {
    if (signal.aborted) throw signal.reason;
    const photo = await load(entry, signal);
    const name = encoder.encode(uniqueName(photo.name, usedNames));
    const nextOffset = offset + 30 + name.length + photo.size;
    if (name.length > 0xffff || nextOffset >= limit32) throw new RangeError("ZIP is too large");
    const crc = await checksum(photo, signal);

    // Method zero stores the exact file bytes. Unset fields stay zero.
    const local = new Uint8Array(30 + name.length);
    const localHeader = new DataView(local.buffer);
    localHeader.setUint32(0, 0x04034b50, true);
    localHeader.setUint16(4, 20, true);
    localHeader.setUint16(6, utf8Flag, true);
    localHeader.setUint16(10, dosTime, true);
    localHeader.setUint16(12, dosDate, true);
    localHeader.setUint32(14, crc, true);
    localHeader.setUint32(18, photo.size, true);
    localHeader.setUint32(22, photo.size, true);
    localHeader.setUint16(26, name.length, true);
    local.set(name, 30);
    parts.push(local, photo);

    const central = new Uint8Array(46 + name.length);
    const centralHeader = new DataView(central.buffer);
    centralHeader.setUint32(0, 0x02014b50, true);
    centralHeader.setUint16(4, 20, true);
    central.set(local.subarray(4, 28), 6);
    centralHeader.setUint32(42, offset, true);
    central.set(name, 46);
    directory.push(central);
    directorySize += central.length;
    offset = nextOffset;
    onProgress(index + 1);
  }

  const end = new DataView(new ArrayBuffer(22));
  if (offset + directorySize + end.byteLength >= limit32) throw new RangeError("ZIP is too large");
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...directory, end.buffer], { type: "application/zip" });
}
