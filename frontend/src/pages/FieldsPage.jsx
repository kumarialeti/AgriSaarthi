import React, { useState, useEffect } from 'react';
import api from '../services/api';

function FieldsPage() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFields();
  }, []);

  const fetchFields = async () => {
    try {
      const { data } = await api.get('/farmer/fields');
      setFields(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4">Loading fields...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4 text-agri-green">My Fields</h1>
      
      <div className="grid gap-4 md:grid-cols-2">
        {fields.length === 0 ? (
          <p>No fields found. Add a field to manage your farm.</p>
        ) : (
          fields.map(field => (
            <div key={field.id} className="p-4 border rounded shadow-sm bg-white">
              <h3 className="font-semibold text-lg">{field.name}</h3>
              <p className="text-sm text-gray-600">{field.area} {field.area_unit}</p>
              <p className="text-sm">Soil: {field.soil_type || 'Unknown'} (pH: {field.soil_ph || 'N/A'})</p>
              <p className="text-sm">Irrigation: {field.irrigation_source || 'Unknown'}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default FieldsPage;
