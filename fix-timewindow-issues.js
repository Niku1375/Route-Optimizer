// Script to fix TimeWindow issues in RoutingService
const fs = require('fs');

function fixTimeWindowIssues(content) {
  // Replace all instances of new Date(request.timeWindow.earliest)
  content = content.replace(
    /new Date\(request\.timeWindow\.earliest\)/g,
    'this.getEarliestTime(request.timeWindow)'
  );

  // Replace all instances of new Date(request.timeWindow.latest)
  content = content.replace(
    /new Date\(request\.timeWindow\.latest\)/g,
    'this.getLatestTime(request.timeWindow)'
  );

  // Replace all instances of new Date(delivery.timeWindow.earliest)
  content = content.replace(
    /new Date\(delivery\.timeWindow\.earliest\)/g,
    'this.getEarliestTime(delivery.timeWindow)'
  );

  // Replace all instances of new Date(delivery.timeWindow.latest)
  content = content.replace(
    /new Date\(delivery\.timeWindow\.latest\)/g,
    'this.getLatestTime(delivery.timeWindow)'
  );

  // Fix the priority level issue
  content = content.replace(
    /priorityLevel: this\.determinePriorityLevel\(route, request\)/g,
    'priorityLevel: this.determinePriorityLevel(route, request) as "high" | "urgent"'
  );

  return content;
}

console.log('Fixing TimeWindow issues in RoutingService...');

const filePath = 'src/services/RoutingService.ts';
if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = fixTimeWindowIssues(content);
  fs.writeFileSync(filePath, content);
  console.log('Fixed TimeWindow issues in RoutingService.ts');
}

console.log('TimeWindow fixes completed!');