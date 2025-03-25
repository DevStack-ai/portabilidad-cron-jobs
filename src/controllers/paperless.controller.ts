import "dotenv/config";
import axios from "axios";
// import { ISOFT_INPUT, PrismaClient } from "@prisma/client";
import fs from "fs";
import { generateXMLTemplate } from "../utils/generatePayload";
import { ISOFT_INPUT } from "@prisma/client";
import sharp from "sharp";
import Printer from "../utils/utils"
import moment from "moment";
// import { authHMAC } from "../utils/authHMAC";

const print = new Printer("paperless-controller");
export class PaperlessController {


    constructor() { }

    async login(user: string, password: string) {
        //consumir endpoint para logearse
        const apikey = await fetch('url', {
            method: 'POST',
            body: JSON.stringify({
                user: user,
                password: password
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return apikey;
    }

    async getSPN(input: ISOFT_INPUT): Promise<string> {
        try {

            const payload = {
                "IDISOFT": input.IDISOFT,
                "MSISDN": input.MSISDN,
                "DONOR_OP": input.DONOR_OP,
                "NOMBRE_DE_CLIENTE": input.NOMBRE_DE_CLIENTE,
                "CEDULA": input.CEDULA,
                "DIRECCION_CLIENTE": input.DIRECCION_CLIENTE,
                "EMAIL_DEL_CLIENTE": input.EMAIL_DEL_CLIENTE,
                "NOMBRE_VENDEDOR": input.nombre_vendedor,
                "CEDULA_VENDEDOR": input.cedula_vendedor,
                "FIRMA_VENDEDOR": input.firma_vendedor,
                "FIRMA_CLIENTE": input.firma_cliente,
                "NIP": input.nip
            }
            const query = await axios.post(`${process.env.BASE_API_URL}/porta-request/spn`, payload);

            if (query.status === 200) {
                return query.data.url;
            } else {
                return "ERROR";
            }
        } catch (e) {
            print.log(e);
            return "ERROR";
        }

    }

    generateContract(contract: any) {
        return new Promise(async (resolve, reject) => {
            try {

                const headers = {
                    'Content-Type': 'multipart/form-data',
                    'Accept': 'application/json',
                    'X-API-Token': `${process.env.CONTRACT_API_KEY}`
                }

                if (process.env.CONTRACT_API_URL === undefined) throw new Error('CONTRACT_API_URL is not defined');

                const form = new FormData();
                const str = generateXMLTemplate(contract);
                const filename = `TESTPREPAGOISOFT${contract.request_number}.xml`
                const dir = `${process.env.TMP_DIR}/${filename}`

                fs.writeFileSync(dir, str);
                const file = fs.readFileSync(dir);
                const xml = new Blob([file], { type: 'application/xml' });

                form.append("source_file", xml, filename);
                form.append('source_url', process.env.CONTRACT_API_URL);
                form.append('websign', "true");
                form.append('privileged', "true");
                form.append('source_action', "Try it out");
                form.append("source_app", "IsoftApp");

                // const auth = authHMAC(str);
                const request_time = new Date().toJSON().slice(0, 19)
                const params = `request_time=${request_time}-06:00`;

                const url = `${process.env.CONTRACT_API_URL}/api/v2/contracts?${params}`;

                const query = await axios.post(url, form, { headers: headers });

                const row = query.data.contracts[0]
                resolve(row.id);
                fs.unlinkSync(dir);

            } catch (e) {
                reject(e);
            }
        });
    }

    uploadId(contractId: string, filePath: string, type: string) {
        return new Promise(async (resolve, reject) => {
            try {

                const headers = {
                    'Content-Type': 'multipart/form-data',
                    'Accept': 'application/json',
                    'X-API-Token': `${process.env.CONTRACT_API_KEY}`
                }

                if (process.env.CONTRACT_API_URL === undefined) throw new Error('CONTRACT_API_URL is not defined');

                const form = new FormData();

                const filename = `${moment().format("YYYYMMDDHHmmss")}-${Math.floor(Math.random() * 100)}-cedula${type === "PRE" ? "prepaid" : "postpaid"}.png`
                const fetchFile = await axios.get(filePath, { responseType: 'arraybuffer' });
                let file = fetchFile.data

                // print.log(`File url ${filePath} `);
                //write in tmp
                const dir = `${process.env.TMP_DIR}/${filename}`
                fs.writeFileSync(dir, file);

                const image = sharp(file);
                if (!image) throw new Error('Image is not valid')
                const metadata = await image.metadata();
                const size = (metadata.size || file.byteLength) / (1024 * 1000);


                print.log(`Image size ${size.toFixed(2)}MB`);
                //check size of file dont exceed 1MB
                if (size > 1) {
                    //resize image to 800Kb
                    print.log(`Resizing image from ${size.toFixed(2)}MB to 800Kb`);
                    //if 1MB is 100% how much I have to reduce to get 800Kb
                    const percent = Math.floor((100 * 800) / (size * 1000))
                    const new_size = size / percent;
                    print.log(`New size ${new_size.toFixed(2)}MB`);
                    print.log(`Percent ${percent.toFixed(2)}%`);

                    file = await image.jpeg({ quality: percent }).toFile(dir);
                } else {
                    print.log(`Quality 100%`);
                    file = await image.jpeg({ quality: 100 }).toFile(dir);
                }

                const blob = fs.readFileSync(dir);
                const cedula = new Blob([blob], { type: 'image/jpeg' });


                form.append("file", cedula, filename);
                form.append('name', "cedulacliente");
                form.append('type', "identification");

                const request_time = new Date().toISOString();
                const params = `request_time=${request_time}`;

                const url = `${process.env.CONTRACT_API_URL}/api/v2/contracts/${contractId}/attachments?${params}`;

                const query = await axios.post(url, form, { headers: headers });
                resolve(query);
                fs.unlinkSync(dir);

            } catch (e) {
                print.error(e);
                reject(e);
            }
        });
    }

    uploadLastContract(porta: ISOFT_INPUT, contractId: string) {
        return new Promise(async (resolve, reject) => {
            try {
                if (typeof porta.s3_invoice_path !== "string") {
                    throw new Error('s3_invoice_path is not defined')
                }
                const headers = {
                    'Content-Type': 'multipart/form-data',
                    'Accept': 'application/json',
                    'X-API-Token': `${process.env.CONTRACT_API_KEY}`
                }

                if (process.env.CONTRACT_API_URL === undefined) throw new Error('CONTRACT_API_URL is not defined');

                const form = new FormData();

                const filename = `lastInvoice.jpeg`
                const fetchFile = await axios.get(porta.s3_invoice_path, { responseType: 'arraybuffer' });
                const file = fetchFile.data
                const lastInvoice = new Blob([file], { type: 'image/jpeg' });

                form.append("file", lastInvoice, filename);
                form.append('name', "invoice");
                form.append('type', "banking_documentation");

                const request_time = new Date().toJSON().slice(0, 19)
                const params = `request_time=${request_time}-06:00`;

                const url = `${process.env.CONTRACT_API_URL}/api/v2/contracts/${contractId}/attachments?${params}`;

                const query = await axios.post(url, form, { headers: headers });
                resolve(query);
                fs.unlinkSync(filename);

            } catch (e) {
                reject(e);
            }
        });
    }


    uploadSPN(id: number, contractId: string, filePath: string) {
        return new Promise(async (resolve, reject) => {
            try {

                const headers = {
                    'Content-Type': 'multipart/form-data',
                    'Accept': 'application/json',
                    'X-API-Token': `${process.env.CONTRACT_API_KEY}`
                }

                if (process.env.CONTRACT_API_URL === undefined) throw new Error('CONTRACT_API_URL is not defined');

                const form = new FormData();

                const filename = `spnfirmado${id}.pdf`
                const fetchFile = await axios.get(filePath, { responseType: 'arraybuffer' });
                const file = fetchFile.data
                const cedula = new Blob([file], { type: 'application/pdf' });

                form.append("file", cedula, filename);
                form.append('name', "spnfirmado");
                form.append('type', "spn_attachment");

                const request_time = new Date().toJSON().slice(0, 19)
                const params = `request_time=${request_time}-06:00`;

                const url = `${process.env.CONTRACT_API_URL}/api/v2/contracts/${contractId}/attachments?${params}`;

                const query = await axios.post(url, form, { headers: headers });
                resolve(query);
                fs.unlinkSync(filename);
            } catch (e) {
                reject(e);
            }
        });
    }

    uploadContract(contractId: string, filePath: string) {
        return new Promise(async (resolve, reject) => {
            try {

                const headers = {
                    'Content-Type': 'multipart/form-data',
                    'Accept': 'application/json',
                    'X-API-Token': `${process.env.CONTRACT_API_KEY}`
                }

                if (process.env.CONTRACT_API_URL === undefined) throw new Error('CONTRACT_API_URL is not defined');

                const form = new FormData();

                const filename = `contract.pdf`
                const fetchFile = await axios.get(filePath, { responseType: 'arraybuffer' });
                const file = fetchFile.data
                const contract = new Blob([file], { type: 'application/pdf' });

                form.append("file", contract, filename);
                form.append('name', "service_request");
                form.append('type', "service_request");

                const request_time = new Date().toJSON().slice(0, 19)
                const params = `request_time=${request_time}-06:00`;

                const url = `${process.env.CONTRACT_API_URL}/api/v2/contracts/${contractId}/attachments?${params}`;

                const query = await axios.post(url, form, { headers: headers });
                resolve(query);
                fs.unlinkSync(filename);

            } catch (e) {
                reject(e);
            }
        });
    }

    uploadAuthApcContract(contractId: string, filePath: string) {
        return new Promise(async (resolve, reject) => {
            try {

                const headers = {
                    'Content-Type': 'multipart/form-data',
                    'Accept': 'application/json',
                    'X-API-Token': `${process.env.CONTRACT_API_KEY}`
                }

                if (process.env.CONTRACT_API_URL === undefined) throw new Error('CONTRACT_API_URL is not defined');

                const form = new FormData();

                const exntesion = filePath.split('.').pop();
                const fileType = exntesion === "pdf" ? "application/pdf" : `image/${exntesion}`;

                const filename = `contract.${exntesion}`
                const fetchFile = await axios.get(filePath, { responseType: 'arraybuffer' });
                const file = fetchFile.data
                const contract = new Blob([file], { type: fileType });

                form.append("file", contract, filename);
                form.append('name', "Authorization");
                form.append('type', "authorization");

                const request_time = new Date().toJSON().slice(0, 19)
                const params = `request_time=${request_time}-06:00`;

                const url = `${process.env.CONTRACT_API_URL}/api/v2/contracts/${contractId}/attachments?${params}`;

                const query = await axios.post(url, form, { headers: headers });
                resolve(query);
                fs.unlinkSync(filename);

            } catch (e) {
                reject(e);
            }
        });
    }

    async generateAuthContract(transaction_id: any, type: number = 1): Promise<string> {
        try {

            if (process.env.CONTRACT_API_URL === undefined) throw new Error('CONTRACT_API_URL is not defined');

            const query = await axios.post(`${process.env.BASE_API_URL}/porta-request/apc-contract/${transaction_id}`, { type: type });

            if (query.status === 200) {
                return query.data.url;
            } else {
                return "ERROR";
            }

        } catch (e) {
            print.log(e);
            return "ERROR";
        }
    }


}