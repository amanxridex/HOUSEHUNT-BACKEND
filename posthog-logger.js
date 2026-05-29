const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-http');
const { BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs');
const { resourceFromAttributes } = require('@opentelemetry/resources');

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': 'househunt-backend',
  }),
  logRecordProcessor: new BatchLogRecordProcessor(
    new OTLPLogExporter({
      url: 'https://eu.i.posthog.com/otlp/v1/logs',
      headers: {
        'Authorization': 'Bearer phc_w7kuBCw9omAhgHKULtSMhT5CNHCyCjJq4FWCZ7bcwhyK'
      }
    })
  )
});

sdk.start();
