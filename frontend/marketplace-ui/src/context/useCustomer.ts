import { useContext } from 'react';
import { CustomerContext, type CustomerContextType } from './customerContextDef';

export const useCustomer = (): CustomerContextType => {
  const context = useContext(CustomerContext);
  if (!context) {
    throw new Error('useCustomer must be used within a CustomerProvider');
  }
  return context;
};

export default useCustomer;
