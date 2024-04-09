import "dotenv/config";

import { PrismaClient } from "@prisma/client";


export class DbController {

    private readonly prisma: PrismaClient;

    constructor(){
        this.prisma = new PrismaClient();
    }

    async getData() {
        const data = await this.prisma.user.findMany();
        this.prisma.$disconnect();
        return data
    }
}