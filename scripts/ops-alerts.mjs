export async function publishAlerts(alerts, { github, runUrl, assignee, now = new Date() }) {
  const issues = [];
  for (let page = 1; ; page++) {
    const batch = await github(`/issues?state=open&per_page=100&page=${page}`);
    issues.push(...batch);
    if (batch.length < 100) break;
  }
  for (const alert of alerts) {
    const marker = `<!-- pulse-alert:${alert.code}:${now.toISOString().slice(0, 10)} -->`;
    if (issues.some(issue => issue.body?.includes(marker))) continue;
    const created = await github('/issues', 'POST', { title: `[Ops ${alert.severity}] ${alert.code}`,
      body: `${marker}\n\n${alert.message}\n\nObserved: ${now.toISOString()}\nRun: ${runUrl}\n\nFollow docs/incident-response.md. Acknowledge, contain, and attach recovery evidence before closing.`,
      ...(assignee ? { assignees: [assignee] } : {}) });
    issues.push(created);
  }
}
