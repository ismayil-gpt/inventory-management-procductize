import { Module } from '@nestjs/common';
import { ProductCategoriesController } from './product-categories.controller';

@Module({
  controllers: [ProductCategoriesController],
})
export class ProductCategoriesModule {}
