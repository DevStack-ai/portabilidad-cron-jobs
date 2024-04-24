import "dotenv/config";
import prisma from "./db.connection"
import { ISOFT_INPUT } from "@prisma/client";


interface data {
    data: Array<any>
    ids: Array<number>
}

export class DbController {

    private prisma;

    constructor() {
        this.prisma = prisma;
    }

    async getReport(): Promise<[]> {


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
                CONTRACT_ID as 'contract_id'
            FROM
                ISOFT_INPUT
            WHERE
                PRE_POST = 'POST' AND ESTADO_FTP = 1
                    AND SERIE_DE_SIMCARD REGEXP '^[0-9]+$';`;

        return query as []
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


        await prisma.iSOFT_INPUT.update({
            where: {
                IDISOFT: id
            },
            data: {
                [field]: value
            }
        });

        
    }


    async getDataWithoutContract(estado_oracle: number = 0): Promise<ISOFT_INPUT[]> {

        const where = {
            CONTRATO_GENERADO: 0,
            CONTRACT_ID: null,
            ENVIADO_ORACLE: estado_oracle,
            ERROR: 0,
            CONTRACT_ATTEMPTS: {
                lt: 3
            },
            STEP: 0
        }


        const query = await prisma.iSOFT_INPUT.findMany({
            where: where,
            orderBy: {
                IDISOFT: "desc"
            },
            take: Number(process.env.CONTRACT_BATCH_SIZE)

        })
        

        return query
    }

    async getDataByStep(step: number,  estado_oracle: number = 0): Promise<ISOFT_INPUT[]> {


        const query = await prisma.iSOFT_INPUT.findMany({
            where: {
                CONTRATO_GENERADO: 1,
                ENVIADO_ORACLE: estado_oracle,
                STEP: step,
                CONTRACT_ATTEMPTS: {
                    lt: 3
                }
            },
            orderBy: {
                IDISOFT: "desc"
            },
            take: Number(process.env.CONTRACT_BATCH_SIZE)

        })
        

        return query
    }

    async getDataByStepPostpaid(step: number, estado_oracle: number = 0): Promise<ISOFT_INPUT[]> {


        const query = await prisma.iSOFT_INPUT.findMany({
            where: {
                CONTRATO_GENERADO: 1,
                STEP: step,
                ENVIADO_ORACLE: estado_oracle,
                // PRE_POST: 'POST',
                CONTRACT_ATTEMPTS: {
                    lt: 3
                }
            },
            orderBy: {
                IDISOFT: "desc"
            },
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
}
