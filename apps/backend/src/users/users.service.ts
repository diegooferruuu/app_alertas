import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { componerNombre } from './domain/nombre-persona';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // El nombre completo se compone aquí y en ningún otro sitio: es lo que hace
    // imposible que `full_name` y sus partes digan cosas distintas.
    const user = this.usersRepository.create({
      ...createUserDto,
      segundo_nombre: createUserDto.segundo_nombre?.trim() || null,
      full_name: componerNombre(createUserDto),
    });
    return this.usersRepository.save(user);
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  /**
   * Deja constancia de que la persona registró un documento con estos datos.
   * No afirma que la identidad haya sido autenticada: el OCR extrae datos.
   *
   * `nombre_documento` guarda el nombre de la cuenta en el momento del registro:
   * es el que se contrastó contra el texto del carnet y la referencia contra la
   * que se comparará la confirmación escrita a mano al firmar una declaración
   * jurada.
   *
   * No recibe el nombre por parámetro y no toca `full_name`. Antes sí: el
   * formulario del documento volvía a pedir el nombre y el declarado ahí
   * reemplazaba al de la cuenta. Con el nombre desglosado desde el registro eso
   * sobra y además abría un hueco —la cuenta podía terminar llamándose distinto
   * de como se creó— y dejaba las partes describiendo un nombre que ya no era el
   * de la cuenta. Ahora hay un solo nombre desde el principio.
   */
  async registrarDocumento(id: string, ciHash: string): Promise<User> {
    const usuario = await this.findById(id);

    await this.usersRepository.update(id, {
      documento_registrado: true,
      ci_hash: ciHash,
      nombre_documento: usuario.full_name,
      documento_registrado_en: new Date(),
    });
    return this.findById(id);
  }

  async findByCiHash(ciHash: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { ci_hash: ciHash } });
  }
}
