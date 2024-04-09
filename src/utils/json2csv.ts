function json2csv(data: any[], headers?: string[]): string {
    const csv = [];

    // Extract headers if not provided
    const fields = headers || Object.keys(data[0]);

    // Add header row
    csv.push(fields.join(','));

    // Add data rows
    data.forEach((row) => {
        const values = fields.map((field) => {
            const value = row[field];
            return value === null || value === undefined ? '' : String(value)
        });
        csv.push(values.join(','));
    });

    return csv.join('\n');
}


export { json2csv };