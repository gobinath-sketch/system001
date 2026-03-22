const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'data', 'gkt_courses.xlsx');
try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);
    
    console.log('Total rows found in first sheet:', data.length);
    
    let skipped = 0;
    let missingCode = 0;
    let missingName = 0;
    let missingTech = 0;

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const courseCode = row['Course Code']?.toString().trim();
        const courseName = row['Course Name']?.toString().trim();
        const technology = row['Technology']?.toString().trim();
        
        if (!courseCode || !courseName || !technology) {
            skipped++;
            if (!courseCode) missingCode++;
            if (!courseName) missingName++;
            if (!technology) missingTech++;
            
            if (skipped <= 5) {
                console.log(`Skipped row ${i} -> Code: ${courseCode}, Name: ${courseName}, Tech: ${technology}`);
                console.log('Row object keys:', Object.keys(row));
            }
        }
    }
    
    console.log(`Skipped: ${skipped}`);
    console.log(`Missing Code: ${missingCode}, Missing Name: ${missingName}, Missing Tech: ${missingTech}`);
} catch (err) {
    console.error('Error:', err.message);
}
