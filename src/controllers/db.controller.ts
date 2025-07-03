import "dotenv/config";
import prisma from "./db.connection"
import { ISOFT_INPUT } from "@prisma/client";
import axios from "axios";
import moment from "moment";
import path from "path";
import fs from "fs";
export class DbController {


    constructor() { }

    async getReport(): Promise<[]> {


        const query: [] = await prisma.$queryRaw`
            SELECT
                IDISOFT,
                CASE
                    WHEN port_type_id = 4 THEN "POST_POST"
                    WHEN port_type_id = 5 THEN "PRE_POST"
                END as transaction_type,
                NUMBER_PORT,
                ICCID,
                TRIM(SUBSTRING_INDEX(NOMBRE_DE_CLIENTE, '{|}', 1)) as nombre,
                TRIM(SUBSTRING_INDEX(NOMBRE_DE_CLIENTE, '{|}', -1)) as apellido,
                 CASE
                    WHEN document_type IN (1, 'C') THEN 'C'
                    WHEN document_type IN (2, 'PP') THEN 'PP'
                    ELSE 'C'
                END as doc_type,
                TRIM(CEDULA),
                TRIM(EMAIL_DEL_CLIENTE),
                provincia,
                distrito,
                barriada,
                SUBSTRING(REPLACE(DIRECCION_CLIENTE,',', ''), 1, 40) as address,
                SUBSTRING(REPLACE(DIRECCION_CLIENTE,',', ''), 41, LENGTH(DIRECCION_CLIENTE)) as address2,
                NOMBRE_DEL_PLAN AS 'nombre_del_plan',
                TRIM(discount_code) as DISCOUNT_CODE,
                nip as NIP,
                billgroup as BILLGROUP,
                CONTRACT_ID as 'contract_id',
                area_code,
                TRANSACTION_ID,
                liberate_value,
                source,
                mrc,
                mrc_amount,
                mrc_n,
                fmc_type,
                fmc_account,
                calculated_amount,
                apc_ws_amount,
                fmc_order
            FROM
                ISOFT_INPUT
            WHERE
                port_type_id IN (4, 5)
            AND STEP = 5
            AND SERIE_DE_SIMCARD REGEXP '^[0-9]+$'
            AND enviado_oracle = 0
            AND FECHA_REGISTRO > '2024-07-04'
            `;


        const mapped = query.map((item: any) => item);
        return mapped as []
    }

    async updateLineStep(lines: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            const queue = []

            for (const line of lines) {

                const query = `UPDATE ISOFT_INPUT SET STEP = 6 WHERE CONTRACTID = ${line.CONTRACTID};`

                queue.push(prisma.$queryRaw`${query}`)

            }

            Promise.allSettled(queue).then((results) => {
                resolve(results)
            }).catch((e) => {
                reject(e)
            })

        })


    }

    async sendToLiberate(lines: { transaction_id: number, file_content: string }[]) {

        return new Promise(async (resolve, reject) => {
            try {

                if (!process.env.LIBERATE_WS_NOTIFICATION_P2P) {
                    reject("Liberate WS Notification is not defined")
                    return;
                }

                if (!process.env.LIBERATE_WS_APIKEY) {
                    reject("Liberate WS ApiKey is not defined")
                    return;
                }

                const headers = {
                    apikey: process.env.LIBERATE_WS_APIKEY

                }

                if (!lines.length) {
                    resolve("No lines to send")
                    return;
                }

                console.log("Sending to liberate", lines)
                console.log("Liberate WS Notification", process.env.LIBERATE_WS_NOTIFICATION_P2P)
                const query = await axios.post(process.env.LIBERATE_WS_NOTIFICATION_P2P, {
                    in: lines
                }, { headers })

                const result = query.data
                console.log(JSON.stringify(result))
                if (result.response === 1) {
                    resolve(result)
                } else {
                    reject(result)
                }

            } catch (e) {
                reject(e)
            }


        })

    }

    async updateLine(lines: any[]): Promise<any> {
        return new Promise(async (resolve, reject) => {
            const queue = []

            for (const line of lines) {

                const query = prisma.iSOFT_INPUT.updateMany({
                    where: {
                        CONTRACT_ID: line.contract_id
                    },
                    data: {
                        STEP: 6,
                        file_content: line.liberateLine
                    }
                })
                // console.log(`UPDATE ISOFT_INPUT 
                //             SET STEP = 6,  file_content = \'${line.liberateLine}\'
                //             WHERE CONTRACT_ID = ${line.contract_id};`)
                queue.push(query)
            }

            try {
                await prisma.$transaction(queue)
                resolve(queue)
            } catch (e) {
                reject(e)
            }

        })



    }

    async updateLineP2P(lines: any[]): Promise<any> {
        return new Promise((resolve, reject) => {

            const queue = []

            for (const line of lines) {

                const query = prisma.$queryRaw`UPDATE ISOFT_INPUT 
                            SET file_content = \'${line.liberateLine}\'
                            WHERE CONTRACT_ID = ${line.contract_id};`

                queue.push(query)
            }
            prisma.$transaction(queue)
                .then((results) => {
                    resolve(results)
                }).catch((e) => {
                    reject(e)
                })
        })


    }
    async getReportV2(): Promise<[]> {


        const query: [] = await prisma.$queryRaw`
            SELECT 
                IDISOFT, 
                NUMBER_PORT AS 'number_port',
                '' AS 'ticket',
                '' AS 'estado',
                '' AS 'creado',
                '' AS 'canal',
                '' AS etapa_actual,
                '' AS 'agente',
                NOMBRE_DE_CLIENTE AS 'nombre_de_cliente',
                CEDULA AS 'cedula',
                '' AS 'direccion entrega',
                DIRECCION_CLIENTE AS 'direccion cliente',
                '' AS 'imei',
                GENERADIGITOSENSIM(SERIE_DE_SIMCARD) AS 'serie_de_simcard',
                NOMBRE_DEL_PLAN AS 'nombre_del_plan',
                EMAIL_DEL_CLIENTE AS 'email_del_cliente',
                '' AS 'tipo_de_plan',
                '' AS tipo_equipo,
                '' AS grupo_etapa_final,
                CONTRACT_ID as 'contract_id',
                nip as NIP
            FROM
                ISOFT_INPUT
            WHERE
                port_type_id IN (5)
            AND ESTADO_FTP = 1
            AND SERIE_DE_SIMCARD REGEXP '^[0-9]+$';`;

        const mapped = query.map((item: any) => ({ ...item, NIP: item.NIP || "NULL" }));
        return mapped as []
    }
    async updateReport(ids: any[]): Promise<void> {




        await prisma.iSOFT_INPUT.updateMany({
            where: {
                IDISOFT: {
                    in: ids
                },
                ESTADO_FTP: 1
            },
            data: {
                ESTADO_FTP: 2,
                FECHA_ENVIADOFTP: new Date()
            }
        });



    }

    async updateField(id: number, field: string, value: any): Promise<void> {

        try {

            await prisma.iSOFT_INPUT.update({
                where: {
                    IDISOFT: id
                },
                data: {
                    [field]: value
                }
            });
        } catch (e) {
            console.log("PRISMA DB ERROR", e)
        }


    }


    async getDataWithoutContract(estado_oracle: number = 0): Promise<ISOFT_INPUT[]> {



        const query = await prisma.iSOFT_INPUT.findMany({
            where: {
                CONTRATO_GENERADO: 0,
                CONTRACT_ID: null,
                ENVIADO_ORACLE: estado_oracle,
                ERROR: 0,
                ENVIADO_ORACLE_FECHA: null,
                CONTRACT_ATTEMPTS: {
                    lt: 3
                },
                STEP: 0
            },
            // orderBy: {
            //     IDISOFT: "desc"
            // },
            take: Number(process.env.CONTRACT_BATCH_SIZE)

        })


        return query
    }

    async getDataByStep(step: number, estado_oracle: number = 0): Promise<ISOFT_INPUT[]> {


        const query = await prisma.iSOFT_INPUT.findMany({
            where: {
                CONTRATO_GENERADO: 1,
                ENVIADO_ORACLE: estado_oracle,
                STEP: step,
                ERROR: 0,
                ENVIADO_ORACLE_FECHA: null,
                CONTRACT_ATTEMPTS: {
                    lt: 3
                },

            },
            // orderBy: {
            //     IDISOFT: "desc"
            // },
            take: Number(process.env.CONTRACT_BATCH_SIZE)

        })


        return query
    }

    async getDataByStepPostpaid(step: number, estado_oracle: number = 0): Promise<ISOFT_INPUT[]> {


        const query = await prisma.iSOFT_INPUT.findMany({
            where: {
                CONTRATO_GENERADO: 1,
                STEP: step,
                ERROR: 0,
                ENVIADO_ORACLE_FECHA: null,
                ENVIADO_ORACLE: estado_oracle,
                //PRE_POST: 'POST',
                CONTRACT_ATTEMPTS: {
                    lt: 3
                },
                ORIGEN: {
                    in: [1, 4]
                },
            },
            // orderBy: {
            //     IDISOFT: "desc"
            // },
            take: Number(process.env.CONTRACT_BATCH_SIZE)

        })


        return query
    }

    async failedProcess(ids: number[]): Promise<void> {


        await prisma.iSOFT_INPUT.updateMany({
            where: {
                IDISOFT: {
                    in: ids
                }
            },
            data: {
                CONTRACT_ATTEMPTS: {
                    increment: 1
                },
                // STEP: step
            }
        });



    }
    async successStep(ids: number[], step: number): Promise<void> {


        await prisma.iSOFT_INPUT.updateMany({
            where: {
                IDISOFT: {
                    in: ids
                }
            },
            data: {
                STEP: step
            }
        });



    }

    async closeConnection(): Promise<void> {

        await prisma.$disconnect()

    }

    async getConfig(): Promise<any> {
        const query = await prisma.$queryRaw`
        SELECT 
            *
        FROM
            config;
        `

        return query
    }

    async getUserByLastLogin(date: Date): Promise<[]> {
        const users: [] = await prisma.$queryRaw`
        SELECT 
            u.id,
            u.username,
            u.email,
            u.last_login,
            u.created_at,
            u.updated_at
        FROM
            user u
        WHERE
            u.last_login < ${date}
        ORDER BY
            u.last_login DESC;
        `
        return users
    }

    async disconnect(): Promise<void> {
        console.log("DISCONNECTING")
        await prisma.$disconnect()
    }

    getBillGroup = async (): Promise<string> => {
        return new Promise(async (resolve, reject) => {
            const todayDate = moment().format('YYYY-MM-DD');
            const fileName = `${process.env.TMP_DIR}/billgroup-${todayDate}.csv`

            const dir = fileName
            console.log(dir)
            if (fs.existsSync(dir)) {
                const data = fs.readFileSync(dir, 'utf8').trim()
                console.log('Billgroup from file', data)
                resolve(data)
            } else {
                try {

                    const query = {
                        query: "SELECT  UNICORN.getbillgroup(sysdate) from dual",
                        params: []
                    }
                    const request = await axios.post(`http://35.223.175.142:8080/api/bd/consultar`, query)
                    const response = request.data
                    console.log('Billgroup from API', response)
                    if (response.valid) {
                        const [result]: string[] = Object.values(response.result[0])
                        console.log('Read from billgroup', result)
                        //create file
                        fs.writeFileSync(dir, result);
                        resolve(result)
                    } else {
                        reject(response)
                    }
                } catch (e) {
                    reject(e)
                }
            }

            const tmpDir: string = process.env.TMP_DIR || ""
            fs.readdirSync(tmpDir).forEach(file => {
                if (file.includes('billgroup') && file !== `billgroup-${todayDate}.csv`) {
                    fs.unlinkSync(`${process.env.TMP_DIR}/${file}`)
                }
            })
        })
    }
}