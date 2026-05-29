const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-http');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { LoggerProvider, SimpleLogRecordProcessor } = require('@opentelemetry/sdk-logs');
const { SeverityNumber } = require('@opentelemetry/api-logs');

const exporter = new OTLPLogExporter({
  url: 'https://eu.i.posthog.com/otlp/v1/logs',
  headers: {
    Authorization: 'Bearer phc_w7kuBCw9omAhgHKULtSMhT5CNHCyCjJq4FWCZ7bcwhyK',
  },
});

const loggerProvider = new LoggerProvider({
  resource: resourceFromAttributes({
    'service.name': 'househunt-backend',
  }),
  processors: [new SimpleLogRecordProcessor(exporter)],
});

// make the logger and severity numbers available globally
globalThis.__posthogLogger = loggerProvider.getLogger('househunt-backend');
globalThis.__posthogSeverity = SeverityNumber;
