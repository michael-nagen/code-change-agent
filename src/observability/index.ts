export {
  newTraceId,
  runWithTrace,
  getTraceContext,
  updateTraceContext,
  logEvent,
  startTimer,
  setObservabilitySink,
  resetObservabilitySink,
  describeErrorForLog,
} from './logger.js';
export type {
  ObservabilityEventName,
  LogLevel,
  TraceContext,
  ObservabilityRecord,
  ObservabilitySink,
} from './logger.js';
