const fs = require('fs');
const path = require('path');

const filesToDelete = [
    'c:\\Users\\Akshaya-GKT\\Desktop\\FINAL_ERP\\system001\\client\\src\\components\\opportunity\\tabs\\DocumentsTab.jsx',
    'c:\\Users\\Akshaya-GKT\\Desktop\\FINAL_ERP\\system001\\client\\src\\components\\opportunity\\tabs\\ScopeTab.jsx',
    'c:\\Users\\Akshaya-GKT\\Desktop\\FINAL_ERP\\system001\\client\\src\\components\\opportunity\\tabs\\FinanceTab.jsx',
    'c:\\Users\\Akshaya-GKT\\Desktop\\FINAL_ERP\\system001\\client\\src\\components\\opportunity\\ActivityFeed.jsx',
    'c:\\Users\\Akshaya-GKT\\Desktop\\FINAL_ERP\\system001\\client\\src\\components\\opportunity\\ProgressBar.jsx',
    'c:\\Users\\Akshaya-GKT\\Desktop\\FINAL_ERP\\system001\\client\\src\\components\\opportunity\\DocumentManager.jsx',
    'c:\\Users\\Akshaya-GKT\\Desktop\\FINAL_ERP\\system001\\client\\src\\components\\opportunity\\DocumentUpload.jsx',
    'c:\\Users\\Akshaya-GKT\\Desktop\\FINAL_ERP\\system001\\client\\src\\components\\opportunity\\FinancialSummary.jsx',
    'c:\\Users\\Akshaya-GKT\\Desktop\\FINAL_ERP\\system001\\server\\models\\Document.js',
    'c:\\Users\\Akshaya-GKT\\Desktop\\FINAL_ERP\\system001\\server\\routes\\documentRoutes.js'
];

filesToDelete.forEach(file => {
    try {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
            console.log(`✅ Deleted: ${file}`);
        } else {
            console.log(`⚠️ File not found: ${file}`);
        }
    } catch (err) {
        console.error(`❌ Error deleting ${file}:`, err.message);
    }
});
