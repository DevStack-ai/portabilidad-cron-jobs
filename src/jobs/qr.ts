import "dotenv/config";
import { QrController } from "../controllers/qr.controller";
import cron from "node-cron";
import Printer from "../utils/utils";
import ejs from "ejs";
import nodemailer from "nodemailer";
import ses from "nodemailer-ses-transport";
import fs from "fs";
import axios from "axios";

const print = new Printer("qr_sent");

const task = async () => {
    try {
        print.log(`Starting QR sender process ===================================================================`);
        const qr = new QrController();

        const config = await qr.getConfig();


        const [portaRequest, inputPostpaid, pre2PostIntport, simswap5gPrepaid, simswap5gPostpaid, activacionPrepago] = await Promise.all([
            qr.getQrRequest("ISOFT_INPUT", { status: "STATUS", orderBy: "ADDED_ON" }),
            qr.getQrRequest("AP_ISOFT_INPUT_POSTPAID"),
            qr.getQrRequest("PRE2POST_ISOFT_INPUT_INTPORT"),
            qr.getQrRequest("SIMSWAP5G_ISOFT_PREPAID_SIMSWAP", { orderBy: 'ADDED_ON' }),
            qr.getQrRequest("SIMSWAP5GPOST_ISOFT_POSTPAID_SIMSWAP ", { orderBy: 'ADDED_ON' }),
            qr.getQrRequest("AP_ACTIVACION_PREPAGO ", { orderBy: 'ADDED_ON', readyValue: 4, status: 'IDESTADO' }),
        ]);

        const sources = [
            {
                table: "ISOFT_INPUT",
                ref_field: "IDISOFT",
                orders: portaRequest
            },
            {
                table: "AP_ISOFT_INPUT_POSTPAID",
                ref_field: "TRANSACTION_ID",
                orders: inputPostpaid
            },
            {
                table: "PRE2POST_ISOFT_INPUT_INTPORT",
                ref_field: "TRANSACTION_ID",
                orders: pre2PostIntport
            },
            {
                table: "SIMSWAP5G_ISOFT_PREPAID_SIMSWAP",
                ref_field: "TRANSACTION_ID",
                orders: simswap5gPrepaid
            },
            {
                table: "SIMSWAP5GPOST_ISOFT_POSTPAID_SIMSWAP",
                ref_field: "TRANSACTION_ID",
                orders: simswap5gPostpaid
            },
            {
                table: "AP_ACTIVACION_PREPAGO",
                ref_field: "IDACTIVPRE",
                orders: activacionPrepago
            }
        ];

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

                const item = new Promise(async (resolve, reject) => {
                    try {

                        const templateString = fs.readFileSync(__dirname + "/templates/qr.ejs", 'utf-8');
                        const customerName = order.name || order.NOMBRE_DE_CLIENTE || order.lib_name || order.LIB_NAME || "";
                        const phoneNumber = order.phone || order.PHONE || order.MSISDN || order.msisdn || order.numero || order.NUMERO || "";

                        const qrUrl = `https://isoft-test-v2.me/api/v1/qr?simcardData=${order.esim_qr_data}`;

                        const queryBuffer = await axios.get(qrUrl, { responseType: 'arraybuffer' });
                        const qrCodeImage = queryBuffer.data;

                        const content = ejs.render(templateString, {
                            name: customerName.replace("{|}", ""),
                            phone: phoneNumber,
                            numeroCuenta: config.esim_number,
                            simcardData: order.esim_qr_data,
                            qrCodeUrl: qrUrl
                        });

                        resolve(transporter.sendMail({
                            from: config.esim_ses_email_from,
                            to: order.validated_email,
                            subject: 'Tu eSIM ya está lista - Activa tu línea con el código QR adjunto',
                            html: content,
                            attachments: [
                                {
                                    filename: 'qr-code.png',
                                    content: qrCodeImage,
                                    cid: 'qr-code'
                                }
                            ]
                        }));
                    } catch (error) {
                        reject(error);
                    }
                });

                queue.push(item);
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
    if (process.env.CRON_QR) {
        console.log("init QR as", process.env.CRON_QR)
        cron.schedule(process.env.CRON_QR, () => task())
    }
}

