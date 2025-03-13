import "dotenv/config";
import mysql, { PoolOptions } from 'mysql2';
import fs from 'fs';
import { generateXMLTemplate } from "../utils/generatePayloadApc";
import axios, { Axios, AxiosError } from "axios";

const access: PoolOptions = {
    user: process.env.DATABASE_USER,
    database: "PORTABILIDAD",
    password: process.env.DATABASE_PASS,
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    waitForConnections: true,
    connectionLimit: 10,
};


export class DbController {
    conn: mysql.Pool;

    constructor(is_dev: boolean = false) {
        if (is_dev) {
            const config = {
                ...access,
                database: "PORTABILIDAD_DES"
            }
            console.log("Creating pool", config)
            this.conn = mysql.createPool(config);
        } else {
            console.log("Creating pool", access)
            this.conn = mysql.createPool(access);
        }
    }

    getDataWithoutContract = async (): Promise<any[]> => {

        return new Promise((resolve, reject) => {
            this.conn.query(`SELECT * FROM apc_request WHERE contract_id IS NULL AND attempts < 3`, (err, res: any) => {
                if (err) {
                    reject(err)
                }

                console.log(res)

                const mapped = res.map((r: any) => {
                    return {
                        ...r,
                        payload: JSON.parse(r.payload)
                    }
                })

                resolve(mapped)
            })
        })
    }


    getDataByStep = async (step: number): Promise<any[]> => {
        return new Promise((resolve, reject) => {
            this.conn.query(`SELECT * FROM apc_request WHERE step = ? AND attempts < 3`, [step], (err, res: any) => {
                if (err) {
                    reject(err)
                }

                const mapped = res.map((r: any) => {
                    return {
                        ...r,
                        payload: JSON.parse(r.payload)
                    }
                })

                resolve(mapped)
            })
        })
    }

    generateContract = async (contract: any): Promise<any> => {
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


    uploadAuthContract = async (contractId: number, filePath: string) => {
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


    updateField = async (id: number, field: string, value: any): Promise<void> => {
        return new Promise((resolve, reject) => {
            this.conn.query(`UPDATE apc_request SET ${field} = ? WHERE id = ?`, [value, id], (err) => {
                if (err) {
                    reject(err)
                }
                resolve()
            })
        })
    }

    successStep = async (rows: { id: number }[], step: number): Promise<void> => {
        return new Promise((resolve, reject) => {
            
            if(rows.length === 0) {
                resolve()
            }
            this.conn.query(`UPDATE apc_request SET step = ? WHERE id IN (?)`, [step, rows.map(r => r.id)], (err) => {
                if (err) {
                    reject(err)
                }
                resolve()
            })
        })
    }

    setProcess = async (rows: { id: number }[], status: number): Promise<void> => {
        return new Promise((resolve, reject) => {
            
            if(rows.length === 0) {
                resolve()
            }
            this.conn.query(`UPDATE apc_request SET status = ? WHERE id IN (?)`, [status, rows.map(r => r.id)], (err) => {
                if (err) {
                    reject(err)
                }
                resolve()
            })
        })
    }

    failedStep = async (rows: { id: number }[]): Promise<void> => {
        //increment attempts
        return new Promise((resolve, reject) => {


            if(rows.length === 0) {
                resolve()
            }

            this.conn.query(`UPDATE apc_request SET attempts = attempts + 1 WHERE id IN (?)`, [rows.map(r => r.id)], (err) => {
                if (err) {
                    reject(err)
                }
                resolve()
            })

            //all attempts 3 update status to 3
            this.conn.query(`UPDATE apc_request SET status = 3 WHERE attempts >= 3 AND status != 3`, () => {})
        })
    }

    disconnect = async (): Promise<void> => {
        return new Promise((resolve, reject) => {
            this.conn.end((err) => {
                if (err) {
                    reject(err)
                }
                resolve()
            })
        })
    }


}
