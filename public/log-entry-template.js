// Template para log entry - layout minimalista claro
function createLogEntryMinimalist(log) {
  const timestamp = new Date(log.timestamp).toLocaleTimeString('pt-BR');
  const id = `log-${Math.random().toString(36).substr(2, 9)}`;
  
  // Status
  const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
  const isError = log.statusCode >= 400;
  
  // Icon e cor
  let icon = 'mdi:circle-outline';
  let colorClass = 'text-gray-400';
  
  if (isSuccess) {
    icon = 'mdi:check-circle';
    colorClass = 'text-success';
  } else if (isError) {
    icon = 'mdi:alert-circle';
    colorClass = 'text-error';
  }
  
  // Method badge color
  const methodColors = {
    GET: 'bg-blue-500',
    POST: 'bg-green-500',
    PUT: 'bg-yellow-500',
    DELETE: 'bg-red-500',
    PATCH: 'bg-purple-500'
  };
  
  return `
    <div class="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition">
      <!-- Summary Line -->
      <div class="flex items-center gap-4 p-4 cursor-pointer" onclick="toggleDetails('${id}')">
        <span class="iconify ${colorClass} text-2xl" data-icon="${icon}"></span>
        
        <span class="text-sm text-gray-500 w-20">${timestamp}</span>
        
        ${log.method ? `<span class="px-2 py-1 ${methodColors[log.method] || 'bg-gray-500'} text-white text-xs font-semibold rounded">${log.method}</span>` : ''}
        
        <span class="flex-1 text-gray-900 font-medium truncate">${escapeHtml(log.url || log.message || 'Event')}</span>
        
        ${log.statusCode ? `<span class="px-2 py-1 ${isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} text-sm font-semibold rounded">${log.statusCode}</span>` : ''}
        
        ${log.duration ? `<span class="text-gray-500 text-sm">${log.duration}ms</span>` : ''}
        
        <span class="iconify text-gray-400" data-icon="mdi:chevron-down"></span>
      </div>
      
      <!-- Details (expandable) -->
      <div id="${id}-details" class="hidden border-t border-gray-100 p-4 bg-gray-50">
        <div class="grid grid-cols-2 gap-4 text-sm mb-4">
          <div><span class="text-gray-500">Correlation ID:</span> <span class="text-gray-900 font-mono text-xs">${log.correlationId || 'N/A'}</span></div>
          <div><span class="text-gray-500">User ID:</span> <span class="text-gray-900">${log.userId || 'N/A'}</span></div>
          <div><span class="text-gray-500">IP:</span> <span class="text-gray-900">${log.ip || 'N/A'}</span></div>
          <div><span class="text-gray-500">Duration:</span> <span class="text-gray-900">${log.duration || 0}ms</span></div>
        </div>
        
        ${log.responseBody ? `
          <div class="mt-4">
            <div class="flex items-center gap-2 mb-2">
              <span class="iconify text-primary" data-icon="mdi:code-json"></span>
              <span class="font-semibold text-gray-900">Response</span>
            </div>
            <pre class="bg-white border border-gray-200 rounded-lg p-4 text-xs overflow-x-auto"><code>${escapeHtml(JSON.stringify(log.responseBody, null, 2))}</code></pre>
          </div>
        ` : ''}
        
        ${log.requestBody ? `
          <div class="mt-4">
            <div class="flex items-center gap-2 mb-2">
              <span class="iconify text-primary" data-icon="mdi:upload"></span>
              <span class="font-semibold text-gray-900">Request Body</span>
            </div>
            <pre class="bg-white border border-gray-200 rounded-lg p-4 text-xs overflow-x-auto"><code>${escapeHtml(JSON.stringify(log.requestBody, null, 2))}</code></pre>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}
