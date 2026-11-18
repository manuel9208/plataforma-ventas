import { serializarEmpresaPublica } from '../serializers/empresa.serializer.js';

export const obtener = (req, res) => {
  res.json(serializarEmpresaPublica(req.empresa));
};