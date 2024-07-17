function json2csv(data: any[], headers?: string[]): string {
    const csv: string[] = [];

    if(data.length === 0) return ""
    // Extract headers if not provided
    const fields =  Object.keys(data[0]).filter((header) => header !== "IDISOFT");

    if(!fields) return ""
    // Add header row
    //csv.push(fields.join(','));

    // Add data rows
    data.forEach((row) => {
        const values = fields.map((field) => {
            const value = row[field];
            const escape = value === null || value === undefined ? '' : String(value)
            const clean = escape.replace(/"|'/g, '');
            const accepted = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            return accepted
        });
        csv.push(values.join(','));
    });
    //if last col is empty, add a "NULL" value
    return csv.join('\n');
}


export { json2csv };