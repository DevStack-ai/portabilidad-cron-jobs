import "dotenv/config";

import { PrismaClient } from "@prisma/client";


interface data {
    data: Array<any>
    ids: Array<number>
}

export class DbController {


    constructor() {
    }

    async getReport(): Promise<[]> {
        const prisma = new PrismaClient();

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
                '' AS grupo_etapa_final
            FROM
                ISOFT_INPUT
            WHERE
                PRE_POST = 'POST' AND ESTADO_FTP = 1
                    AND LENGTH(SERIE_DE_SIMCARD) = 19
                    AND SERIE_DE_SIMCARD REGEXP '^[0-9]+$';`;

        prisma.$disconnect();
        return query as []
    }

    async updateReport(ids: any[]): Promise<void> {


        const prisma = new PrismaClient();

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
        prisma.$disconnect();


    }
}