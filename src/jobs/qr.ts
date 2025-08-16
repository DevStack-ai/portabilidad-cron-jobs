import "dotenv/config";
import { QrController } from "../controllers/qr.controller";
import cron from "node-cron";
import Printer from "../utils/utils";
import ejs, { name } from "ejs";
import nodemailer from "nodemailer";
import ses from "nodemailer-ses-transport";
import fs from "fs";

const print = new Printer("sent qr");

const task = async () => {
    try {
        print.log(`Starting QR sender process ===================================================================`);
        const qr = new QrController(true);

        const config = await qr.getConfig();


        const [/*portaRequest, */inputPostpaid, pre2PostIntport, simswap5gPrepaid] = await Promise.all([
            //qr.getQrRequest("porta_request"),
            qr.getQrRequest("AP_ISOFT_INPUT_POSTPAID"),
            qr.getQrRequest("PRE2POST_ISOFT_INPUT_INTPORT"),
            qr.getQrRequest("SIMSWAP5G_ISOFT_PREPAID_SIMSWAP",{
                orderBy: 'ADDED_ON',
            }),
        ]);

        const sources = [/*{
            ///@todo: move this to isoft_input
            table: "porta_request",
            ref_field: "id",
            orders: portaRequest
        }, */{
            table: "AP_ISOFT_INPUT_POSTPAID",
            ref_field: "TRANSACTION_ID",
            orders: inputPostpaid
        }, {
            table: "PRE2POST_ISOFT_INPUT_INTPORT",
            ref_field: "TRANSACTION_ID",
            orders: pre2PostIntport
        }, {
            table: "SIMSWAP5G_ISOFT_PREPAID_SIMSWAP",
            ref_field: "TRANSACTION_ID",
            orders: simswap5gPrepaid
        }];

        const options: any = {
            accessKeyId: config.ses_key_id,
            secretAccessKey: config.ses_access_key,
        };

        const transporter = nodemailer.createTransport(ses(options));

        for (const source of sources) {

            const queue = []
            const update = []
            const orders = source.orders;

            for (const order of orders) {
                const templateString = fs.readFileSync(__dirname + "/templates/qr.ejs", 'utf-8');
                const content = ejs.render(templateString, {
                    name: order.name || "",
                    numeroCuenta: config.esim_number,
                    //@todo: move this to .env
                    qrCodeUrl: `http://164.92.87.2:9005/api/v1/qr?simcardData=${order.esim_qr_data}`
                });

                const mailOptions = {
                    from: config.ses_email_from,
                    to: order.validated_email,
                    subject: 'Tu eSIM ya está lista – Activa tu línea con el código QR adjunto',
                    html: content
                };

                queue.push(transporter.sendMail(mailOptions));
            }

            const result = await Promise.allSettled(queue);
            for (const idx in result) {
                const res = result[idx];
                const order = orders[idx];

                if (res.status === "rejected") {
                    print.log(`Error sending email: ${res.reason}`);
                }

                update.push(qr.markEmailSent(source.table, source.ref_field, order[source.ref_field]));
                print.log(`Email sent successfully: ${JSON.stringify(res)}`);
            }
            await Promise.allSettled(update);

        }
        await qr.disconnect();
        print.log(`End of generate contract ===================================================================`)
    } catch (e) {
        print.log(`Error: ${e}`)
    }
}

if (process.argv.includes('--manual')) {
    task()
} else {
    if (process.env.CRON_PAPERLESS) {
        console.log("init QR as", process.env.CRON_PAPERLESS)
        cron.schedule(process.env.CRON_PAPERLESS, () => task())
    }
}

