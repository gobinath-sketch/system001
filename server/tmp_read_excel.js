const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'data', 'gkt_courses.xlsx');
try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    console.log('Headers:', data[0]);
    console.log('First Row:', data[1]);
} catch (err) {
    console.error('Error reading excel:', err.message);
}
