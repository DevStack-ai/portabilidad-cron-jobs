import "dotenv/config";
import axios from "axios";
// import { ISOFT_INPUT, PrismaClient } from "@prisma/client";
import fs from "fs";
import { generateXMLTemplate } from "../utils/generatePayload";
import { ISOFT_INPUT } from "@prisma/client";
// import { authHMAC } from "../utils/authHMAC";

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

        const payload = {
            "IDISOFT": input.IDISOFT,
            "MSISDN": input.MSISDN,
            "DONOR_OP": input.DONOR_OP,
            "NOMBRE_DE_CLIENTE": input.NOMBRE_DE_CLIENTE,
            "CEDULA": input.CEDULA,
            "DIRECCION_CLIENTE": input.DIRECCION_CLIENTE,
            "EMAIL_DEL_CLIENTE": input.EMAIL_DEL_CLIENTE
        }

        const query = await axios.post(`${process.env.BASE_API_URL}/porta-request/spn`, payload);

        if (query.status === 200) {
            return query.data.url;
        } else {
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

                const filename = `cedula${type === "PRE" ? "prepaid" : "postpaid"}.jpeg`
                const fetchFile = await axios.get(filePath, { responseType: 'arraybuffer' });
                const file = fetchFile.data
                const cedula = new Blob([file], { type: 'image/jpeg' });

                form.append("file", cedula, filename);
                form.append('name', "cedulacliente");
                form.append('type', "identification");

                const request_time = new Date().toISOString();
                const params = `request_time=${request_time}`;

                const url = `${process.env.CONTRACT_API_URL}/api/v2/contracts/${contractId}/attachments?${params}`;

                const query = await axios.post(url, form, { headers: headers });
                resolve(query);
                fs.unlinkSync(filename);

            } catch (e) {
                reject(e);
            }
        });
    }

    uploadLastContract(id: number, contractId: string) {
        return new Promise(async (resolve, reject) => {
            try {

                const headers = {
                    'Content-Type': 'multipart/form-data',
                    'Accept': 'application/json',
                    'X-API-Token': `${process.env.CONTRACT_API_KEY}`
                }

                if (process.env.CONTRACT_API_URL === undefined) throw new Error('CONTRACT_API_URL is not defined');

                const form = new FormData();

                const filename = `lastInvoice.jpeg`
                const fetchFile = await axios.get('https://s3.amazonaws.com/socialmanager/chats/ABGGUCQnhAA_Ags-sMhKaVDo9XPJSw.jpeg', { responseType: 'arraybuffer' });
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

}