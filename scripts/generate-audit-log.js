const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TARGETS = [
  { name: 'Root', dir: '.' },
  { name: 'Client', dir: 'client' },
  { name: 'Server', dir: 'server' },
];

function nowIso() {
  return new Date().toISOString();
}

function timestampForFile() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function runCommand(command, args, cwd) {
  const startedAt = nowIso();
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: true,
  });
  const endedAt = nowIso();

  return {
    startedAt,
    endedAt,
    exitCode: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error ? String(result.error.message || result.error) : '',
  };
}

function runTextCommand(command, args, cwd = process.cwd()) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: true,
  });

  return {
    exitCode: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error ? String(result.error.message || result.error) : '',
  };
}

function normalizeMetadataVulns(metadataVulns) {
  const fallback = { low: 0, moderate: 0, high: 0, critical: 0, info: 0, total: 0 };
  if (!metadataVulns || typeof metadataVulns !== 'object') return fallback;
  const low = Number(metadataVulns.low || 0);
  const moderate = Number(metadataVulns.moderate || 0);
  const high = Number(metadataVulns.high || 0);
  const critical = Number(metadataVulns.critical || 0);
  const info = Number(metadataVulns.info || 0);
  const total = Number(metadataVulns.total || (low + moderate + high + critical + info));
  return { low, moderate, high, critical, info, total };
}

function parseAuditJson(output) {
  try {
    return JSON.parse(output);
  } catch {
    return null;
  }
}

function fixAvailableText(fixAvailable) {
  if (fixAvailable === true) return 'Yes';
  if (fixAvailable === false) return 'No';
  if (!fixAvailable) return 'Unknown';
  if (typeof fixAvailable === 'object') {
    const name = fixAvailable.name || 'package';
    const isMajor = fixAvailable.isSemVerMajor ? ' (major)' : '';
    return `Yes: ${name}${isMajor}`;
  }
  return String(fixAvailable);
}

function listVia(via) {
  if (!Array.isArray(via)) return '';
  return via
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const source = item.source ? `#${item.source}` : '';
        const title = item.title || item.name || 'advisory';
        return [title, source].filter(Boolean).join(' ');
      }
      return '';
    })
    .filter(Boolean)
    .join('; ');
}

function mdEscape(val) {
  return String(val ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function getGitCommand() {
  return 'git';
}

function parseIntSafe(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getRangeText(start, count) {
  if (!count || count <= 0) return 'none';
  if (count === 1) return `${start}`;
  return `${start}-${start + count - 1}`;
}

function getCommitChangeRanges(sha) {
  const git = getGitCommand();
  const diffResult = runTextCommand(git, ['show', '--unified=0', '--pretty=format:', sha]);
  if (diffResult.error || diffResult.exitCode !== 0) {
    return [];
  }

  const lines = diffResult.stdout.split(/\r?\n/);
  const ranges = [];
  let currentFile = '';

  for (const line of lines) {
    const fileMatch = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (fileMatch) {
      currentFile = fileMatch[2];
      continue;
    }

    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch && currentFile) {
      const oldStart = Number.parseInt(hunkMatch[1], 10);
      const oldCount = Number.parseInt(hunkMatch[2] || '1', 10);
      const newStart = Number.parseInt(hunkMatch[3], 10);
      const newCount = Number.parseInt(hunkMatch[4] || '1', 10);

      ranges.push({
        file: currentFile,
        oldRange: getRangeText(oldStart, oldCount),
        newRange: getRangeText(newStart, newCount),
      });
    }
  }

  return ranges;
}

function getGitChangeLog() {
  const git = getGitCommand();
  const commitCount = parseIntSafe(process.env.AUDIT_GIT_COUNT, 20);
  const authorFilter = String(process.env.AUDIT_GIT_AUTHOR || '').trim();
  const sinceFilter = String(process.env.AUDIT_GIT_SINCE || '').trim();
  const pathFilter = String(process.env.AUDIT_GIT_PATH || '').trim();

  const args = ['log', '--date=iso', '--pretty=format:%H', '-n', String(commitCount)];
  if (authorFilter) args.push(`--author=${authorFilter}`);
  if (sinceFilter) args.push(`--since=${sinceFilter}`);
  if (pathFilter) args.push('--', pathFilter);

  const listResult = runTextCommand(git, args);
  if (listResult.error || listResult.exitCode !== 0) {
    return {
      status: 'unavailable',
      error: listResult.error || listResult.stderr || 'Unable to read git log.',
      commits: [],
    };
  }

  const commits = listResult.stdout
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean);

  const details = commits.map((sha) => {
    const metaResult = runTextCommand(git, ['show', '-s', '--date=iso', '--pretty=format:%h|%an|%ad|%s', sha]);
    if (metaResult.error || metaResult.exitCode !== 0 || !metaResult.stdout.trim()) {
      return null;
    }
    const parts = metaResult.stdout.split('|');
    const shortSha = parts[0] || '';
    const author = parts[1] || '';
    const date = parts[2] || '';
    const subject = parts.slice(3).join('|') || '';

    return {
      shortSha,
      author,
      date,
      subject,
      ranges: getCommitChangeRanges(sha),
    };
  }).filter(Boolean);

  const statusResult = runTextCommand(git, ['status', '--short']);
  return {
    status: 'ok',
    error: '',
    commits: details,
    workingTree: statusResult.stdout || '',
  };
}

function analyzeTarget(target) {
  const cwd = path.resolve(target.dir);
  const command = 'npm';
  const args = ['audit', '--json', '--ignore-scripts'];
  const execution = runCommand(command, args, cwd);
  const json = parseAuditJson(execution.stdout);

  const metadataVulns = normalizeMetadataVulns(json?.metadata?.vulnerabilities);
  const totalDependencies = Number(json?.metadata?.totalDependencies || 0);
  const vulnerabilities = json?.vulnerabilities && typeof json.vulnerabilities === 'object'
    ? Object.entries(json.vulnerabilities).map(([pkg, details]) => ({
      packageName: pkg,
      severity: details?.severity || 'unknown',
      isDirect: Boolean(details?.isDirect),
      range: details?.range || '',
      via: listVia(details?.via),
      fixAvailable: fixAvailableText(details?.fixAvailable),
    }))
    : [];

  let status = 'Completed';
  if (execution.error) status = 'Command Error';
  else if (!json && execution.exitCode !== 0) status = 'Failed (No JSON)';
  else if (metadataVulns.total > 0) status = 'Completed (Vulnerabilities Found)';
  else status = 'Completed (No Vulnerabilities)';

  return {
    target,
    cwd,
    command: `${command} ${args.join(' ')}`,
    execution,
    parsed: Boolean(json),
    status,
    totalDependencies,
    metadataVulns,
    vulnerabilities,
  };
}

function buildMarkdown(results) {
  const generatedAt = nowIso();
  const machine = process.env.COMPUTERNAME || process.env.HOSTNAME || 'Unknown';
  const gitLog = getGitChangeLog();

  let md = '';
  md += '# NPM Audit Log Report\n\n';
  md += '## Report Metadata\n\n';
  md += `- Generated At: ${generatedAt}\n`;
  md += `- Generated By: ${process.env.USERNAME || process.env.USER || 'Unknown'}\n`;
  md += `- Machine: ${machine}\n`;
  md += `- Node Version: ${process.version}\n\n`;
  md += '## Code Change History\n\n';

  if (gitLog.status !== 'ok') {
    md += `- Git log status: ${mdEscape(gitLog.status)}\n`;
    md += `- Error: ${mdEscape(gitLog.error)}\n\n`;
  } else if (gitLog.commits.length === 0) {
    md += '- No commits found for the current filter.\n\n';
  } else {
    gitLog.commits.forEach((commit, index) => {
      md += `### Commit ${index + 1}: ${mdEscape(commit.shortSha)}\n\n`;
      md += `- Author: ${mdEscape(commit.author)}\n`;
      md += `- Date: ${mdEscape(commit.date)}\n`;
      md += `- Message: ${mdEscape(commit.subject)}\n`;
      if (!commit.ranges.length) {
        md += '- Changed lines: (no hunk ranges parsed)\n\n';
      } else {
        md += '- Changed lines:\n\n';
        md += '| File | Old Lines | New Lines |\n';
        md += '| --- | --- | --- |\n';
        commit.ranges.forEach((range) => {
          md += `| ${mdEscape(range.file)} | ${mdEscape(range.oldRange)} | ${mdEscape(range.newRange)} |\n`;
        });
        md += '\n';
      }
    });

    md += '### Working Tree (Uncommitted)\n\n';
    if (gitLog.workingTree.trim()) {
      md += '```text\n';
      md += `${gitLog.workingTree.trim()}\n`;
      md += '```\n\n';
    } else {
      md += 'No uncommitted changes.\n\n';
    }
  }

  md += '## Detailed Findings\n\n';

  results.forEach((r, i) => {
    md += `### ${i + 1}. ${r.target.name}\n\n`;
    md += `- Location: \`${r.cwd}\`\n`;
    md += `- Command: \`${r.command}\`\n`;
    md += `- Start Time: ${r.execution.startedAt}\n`;
    md += `- End Time: ${r.execution.endedAt}\n`;
    md += `- Exit Code: ${r.execution.exitCode}\n`;
    md += `- Status: ${r.status}\n\n`;

    if (r.execution.error) {
      md += '**Command Error**\n\n';
      md += '```text\n';
      md += `${r.execution.error}\n`;
      md += '```\n\n';
    }

    if (r.vulnerabilities.length === 0) {
      md += 'No vulnerability entries reported.\n\n';
    } else {
      md += '| Package | Severity | Direct Dependency | Affected Range | Via | Fix Available |\n';
      md += '| --- | --- | --- | --- | --- | --- |\n';
      r.vulnerabilities
        .sort((a, b) => String(a.severity).localeCompare(String(b.severity)))
        .forEach((v) => {
          md += `| ${mdEscape(v.packageName)} | ${mdEscape(v.severity)} | ${v.isDirect ? 'Yes' : 'No'} | ${mdEscape(v.range)} | ${mdEscape(v.via)} | ${mdEscape(v.fixAvailable)} |\n`;
        });
      md += '\n';
    }

    if (r.execution.stderr.trim()) {
      md += '<details>\n';
      md += '<summary>stderr output</summary>\n\n';
      md += '```text\n';
      md += `${r.execution.stderr.trim()}\n`;
      md += '```\n\n';
      md += '</details>\n\n';
    }
  });

  const hasAnyVuln = results.some((r) => r.metadataVulns.total > 0);
  md += '## Final Conclusion\n\n';
  if (hasAnyVuln) {
    md += '- Vulnerabilities were detected in one or more scopes.\n';
    md += '- Review fix availability and apply updates in a controlled release process.\n';
  } else {
    md += '- No vulnerabilities were reported across the scanned scopes.\n';
  }

  return md;
}

function main() {
  const results = TARGETS.map(analyzeTarget);
  const markdown = buildMarkdown(results);

  const outputDir = path.resolve('audit-logs');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const fileName = `npm-audit-log-${timestampForFile()}.md`;
  const fullPath = path.join(outputDir, fileName);
  fs.writeFileSync(fullPath, markdown, 'utf8');

  console.log(`Audit log generated: ${fullPath}`);
}

main();
