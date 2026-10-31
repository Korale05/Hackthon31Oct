import bcrypt from "bcrypt";



export async function hashPassword(password: string) {
    const hashedPassword = await bcrypt.hash(password, 10);

    return hashedPassword;
}

export async function comparePassword(
    password: string,
    passwordHash: string
) {
    return await bcrypt.compare(password, passwordHash);
}