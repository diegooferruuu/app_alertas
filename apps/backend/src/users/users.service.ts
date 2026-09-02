import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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

    const user = this.usersRepository.create(createUserDto);
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

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    await this.usersRepository.update(id, updateUserDto);
    return this.findById(id);
  }

  /**
   * Deja constancia de que la persona registró un documento con estos datos.
   * No afirma que la identidad haya sido autenticada: el OCR extrae datos.
   *
   * El nombre se guarda porque es la referencia contra la que se comparará la
   * confirmación escrita a mano al firmar una declaración jurada.
   */
  async registrarDocumento(
    id: string,
    ciHash: string,
    nombreDocumento: string,
  ): Promise<User> {
    await this.usersRepository.update(id, {
      documento_registrado: true,
      ci_hash: ciHash,
      nombre_documento: nombreDocumento,
      documento_registrado_en: new Date(),
    });
    return this.findById(id);
  }

  async findByCiHash(ciHash: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { ci_hash: ciHash } });
  }
}
