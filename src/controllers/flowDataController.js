const FlowData = require('../models/FlowData');
const Flow = require('../models/Flow');

exports.getFlowData = async (req, res) => {
  try {
    const { id } = req.params;

    const flowData = await FlowData.findById(id);

    if (!flowData) {
      return res.status(404).json({
        success: false,
        message: 'FlowData não encontrado'
      });
    }

    const flow = await Flow.findOne({ flowDataId: id });
    if (!flow || flow.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    res.json({
      success: true,
      data: flowData
    });
  } catch (error) {
    console.error('Erro ao buscar FlowData:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar dados do flow'
    });
  }
};

exports.updateFlowData = async (req, res) => {
  try {
    const { id } = req.params;
    const { data } = req.body;

    const flow = await Flow.findOne({ flowDataId: id });
    if (!flow) {
      return res.status(404).json({
        success: false,
        message: 'Flow não encontrado'
      });
    }

    if (flow.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    const currentFlowData = await FlowData.findById(id);
    if (!currentFlowData) {
      return res.status(404).json({
        success: false,
        message: 'FlowData não encontrado'
      });
    }

    const updateFields = {
      lastModifiedBy: req.user.userId,
      version: currentFlowData.version + 1
    };

    if (data !== undefined) {
      updateFields.data = data;
    }

    const flowData = await FlowData.findByIdAndUpdate(
      id,
      updateFields,
      { new: true, runValidators: true }
    );

    // Atualizar totalNodes no Flow
    if (data && data.nodes) {
      flow.totalNodes = data.nodes.length;
      await flow.save();
    }

    res.json({
      success: true,
      data: flowData
    });
  } catch (error) {
    console.error('Erro ao atualizar FlowData:', error);
    res.status(500).json({
      success: false,
    message: 'Erro ao atualizar dados do flow'
    });
  }
};

exports.getFlowDataByFlowId = async (req, res) => {
  try {
    const { flowId } = req.params;

    const flow = await Flow.findById(flowId);
    if (!flow) {
      return res.status(404).json({
        success: false,
        message: 'Flow não encontrado'
      });
    }

    if (flow.userId.toString() !== req.user.userId && !flow.isPublic) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    const flowData = await FlowData.findOne({ flowId: flowId });

    if (!flowData) {
      return res.status(404).json({
        success: false,
        message: 'FlowData não encontrado'
      });
    }

    res.json({
      success: true,
      data: flowData
    });
  } catch (error) {
    console.error('Erro ao buscar FlowData por flowId:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar dados do flow'
    });
  }
};

exports.deleteFlowData = async (req, res) => {
  try {
    const { id } = req.params;

    const flow = await Flow.findOne({ flowDataId: id });
    if (!flow) {
      return res.status(404).json({
        success: false,
        message: 'Flow não encontrado'
      });
    }

    if (flow.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    await FlowData.findByIdAndDelete(id);

    flow.flowDataId = null;
    await flow.save();

    res.json({
      success: true,
      message: 'FlowData deletado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar FlowData:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar dados do flow'
    });
  }
};