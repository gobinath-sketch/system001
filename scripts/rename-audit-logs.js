const fs = require('fs');
const path = require('path');

const outputDir = path.resolve('audit-logs');

function toHumanTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = String(date.getFullYear()).slice(-2);
  let hours = date.getHours();
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const meridiem = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  return `${day}-${month}-${year}-${pad(hours)}.${minutes}.${seconds}-${meridiem}`;
}

function getTypeFromName(name) {
  const lower = name.toLowerCase();
  if (lower.includes('full')) return 'full';
  if (lower.includes('npm')) return 'npm';
  return 'general';
}

function main() {
  if (!fs.existsSync(outputDir)) {
    console.log(`No audit-logs directory found at ${outputDir}`);
    return;
  }

  const files = fs.readdirSync(outputDir)
    .filter((name) => name.toLowerCase().endsWith('.md'))
    .map((name) => {
      const fullPath = path.join(outputDir, name);
      const stat = fs.statSync(fullPath);
      return { name, fullPath, mtime: stat.mtime };
    })
    .sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

  if (files.length === 0) {
    console.log('No markdown audit logs to rename.');
    return;
  }

  const tempMappings = [];
  files.forEach((file, idx) => {
    const tempName = `__tmp__${String(idx + 1).padStart(4, '0')}__${file.name}`;
    const tempPath = path.join(outputDir, tempName);
    fs.renameSync(file.fullPath, tempPath);
    tempMappings.push({
      oldName: file.name,
      tempName,
      mtime: file.mtime,
      type: getTypeFromName(file.name),
    });
  });

  tempMappings.forEach((entry, idx) => {
    const sequence = String(idx + 1).padStart(2, '0');
    const finalName = `${sequence}-audit-log-${entry.type}-${toHumanTimestamp(entry.mtime)}.md`;
    fs.renameSync(
      path.join(outputDir, entry.tempName),
      path.join(outputDir, finalName)
    );
    console.log(`${entry.oldName} -> ${finalName}`);
  });
}

main();
