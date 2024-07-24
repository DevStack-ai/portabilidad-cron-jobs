import "dotenv/config";
import { FtpController } from "../controllers/ftp.controller";
import { DbController } from "../controllers/db.controller";

import { json2csv } from "../utils/json2csv";
import fs from "fs";
import moment from "moment";
import Printer from "../utils/utils";
import cron from "node-cron";

const print = new Printer("report-ftp");

// const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const task = async () => {
    try {
        print.log(`Starting report ftp ===================================================================`);
        const ftp = new FtpController();
        const db = new DbController();

        const host = process.env.FTP_HOST;
        const port = Number(process.env.FTP_PORT);
        const username = process.env.FTP_USER;
        const password = process.env.FTP_PASS;

        if (!host || !port || !username || !password) {
            throw new Error("FTP settings are not set in .env file");
        }

        print.log(`Connecting to FTP`);
        await ftp.connect({ host, port, username, password });
        print.log(`Connected to FTP`);


        print.log(`Fetch from database`);
        const data = await db.getReport();
        // const datav2 = await db.getReportV2();
        print.log(`Fetched v1: ${data.length} records`);
        // print.log(`Fetched v2: ${datav2.length} records`);
        
        const ids = data.map((item: any) => item.IDISOFT)
        // const idsV2 = datav2.map((item: any) => item.IDISOFT)
        print.log(`Converted to CSV`);
        const csv = json2csv(data);
        // const csvV2 = json2csv(datav2);
       
        const today = moment().format("YYYYMMDDHHmmss")
        const filename = `TIGO_POSTPORT_${today}.csv`;
        const dir = `${process.env.TMP_DIR}/${filename}`
        print.log(`Writing to file: ${dir}`);
        fs.writeFileSync(dir, csv, { encoding: 'utf-8' });
        print.log(`File written successfully`);

        // await sleep(1000);
        
        // const todayV2 = moment().format("YYYYMMDDHHmmss")
        // const filenameV2 = `TIGO_POSTPORT_${todayV2}.csv`;
        // const dirV2 = `${process.env.TMP_DIR}/${filenameV2}`
        // print.log(`Writing to file: ${dirV2}`);
        // fs.writeFileSync(dirV2, csvV2, { encoding: 'utf-8' });
        // print.log(`Filev2 written successfully`);

        const toPath = `${process.env.FTP_DIR}/${filename}`;
        // const toPathV2 = `${process.env.FTP_DIR}/${filenameV2}`;
        if(csv){
            print.log(`Uploading to FTP: ${toPath}`)
            await ftp.uploadFile(dir, toPath);
            print.log(`Uploaded successfully ===================================================================`);
        }else{
            print.log(`No data to upload to FTP ================================================================`);
            return
        }
        
        // if(csvV2){
        //     print.log(`Uploading to FTP: ${toPathV2}`)
        //     await ftp.uploadFile(dirV2, toPathV2);
        //     print.log(`Uploaded successfully ===================================================================`);
        // }else{
        //     print.log(`No datav2 to upload to FTP ==============================================================`);
        // }

        print.log('Updating database');
        await db.updateReport(ids);
        // await db.updateReport(idsV2);
        print.log(`Database updated`);

        print.log(`End of report ftp ===================================================================`)
    } catch (e) {
        console.log(e)
        print.log(`Error: ${e}`)
    }

}

if (process.argv.includes('--manual')) {
    task()
} else {
    if (process.env.CRON_REPORT) {
        console.log("init report as", process.env.CRON_REPORT)
        cron.schedule(process.env.CRON_REPORT, () => task())
    }
}
