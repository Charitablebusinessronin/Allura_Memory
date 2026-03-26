// ADRLogger.ts

// Event-driven Architecture Decision Record logging

// Lifecycle events
const events = [
    'spawn',
    'delegate',
    'decide',
    'fail',
    'retry',
    'promote',
    'terminate'
];

// ADRRecord interface
interface ADRRecord {
    event: string;
    timestamp: string;
    details: any;
}

// ADRLogger class
class ADRLogger {
    private records: ADRRecord[] = [];

    // Method to log events
    logEvent(event: string, details: any): void {
        const record: ADRRecord = {
            event,
            timestamp: new Date().toISOString(),
            details,
        };
        this.records.push(record);
    }

    // Method to enrich record with additional data
    enrichRecord(index: number, enrichments: any): void {
        if (index < this.records.length) {
            this.records[index].details = { ...this.records[index].details, ...enrichments };
        }
    }

    // Method to capture a decision
    captureDecision(decision: any): void {
        this.logEvent('decide', decision);
    }

    // Method to capture a failure
    captureFailure(failure: any): void {
        this.logEvent('fail', failure);
    }

    // Method to retrieve group records
    getGroupRecords(eventType: string): ADRRecord[] {
        return this.records.filter(record => record.event === eventType);
    }

    // Method to flush records to persistence (e.g., database)
    flushToPersistence(): void {
        // Logic to save this.records to a persistence layer
        console.log('Records have been saved!');
    }
}

export default ADRLogger;