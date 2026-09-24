import express from 'express';
import { getPorts, getPortById, updatePort } from '../controllers/portController.js';

const router = express.Router();

router.get('/', getPorts);
router.get('/:id', getPortById);
router.put('/:id', updatePort);

export default router;
